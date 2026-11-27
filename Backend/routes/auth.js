const router = require('express').Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const memoryResetTokens = new Map();
let resetColsReady = false;
let resetColsChecked = null;

function ensureResetColumns() {
  if (resetColsChecked) return resetColsChecked;
  resetColsChecked = (async () => {
    try {
      await db.query(
        `ALTER TABLE users
           ADD COLUMN IF NOT EXISTS reset_token TEXT,
           ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ`
      );
      resetColsReady = true;
    } catch (e) {
      try {
        const check = await db.query(
          `SELECT column_name FROM information_schema.columns
           WHERE table_name = 'users' AND column_name IN ('reset_token', 'reset_token_expires')`
        );
        if (check.rowCount >= 2) {
          resetColsReady = true;
        } else {
          console.warn('Reset token columns unavailable on users, using in-memory fallback:', e.message);
        }
      } catch {
        console.warn('Reset token columns unavailable on users, using in-memory fallback.');
      }
    }
  })();
  return resetColsChecked;
}

const sign = u => jwt.sign({ id: u.user_id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
const publicUser = u => ({
  user_id: u.user_id,
  full_name: u.full_name,
  email: u.email,
  role: u.role,
  avatar_url: u.avatar_url,
  trips_count: Number(u.trips_count ?? 0),
});

async function requireAuth(req, res, next) {
  let p;
  try { p = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), process.env.JWT_SECRET); }
  catch (e) { return res.status(401).json({ error: 'Not authenticated' }); }
  try {
    const r = await db.query('SELECT is_active FROM users WHERE user_id = $1', [p.id]);
    if (!r.rowCount || r.rows[0].is_active === false) return res.status(403).json({ error: 'This account is suspended.' });
    req.user = p; next();
  } catch (e) { res.status(500).json({ error: 'Server error.' }); }
}

router.post('/register', async (req, res) => {
  try {
    const { full_name, email, password } = req.body;
    if (!full_name || !email || !password) return res.status(400).json({ error: 'All fields are required.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    const exists = await db.query('SELECT 1 FROM users WHERE email = $1', [email.toLowerCase()]);
    if (exists.rowCount) return res.status(409).json({ error: 'Email is already registered.' });
    const hash = await bcrypt.hash(password, 10);
    const r = await db.query(
      `INSERT INTO users (full_name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'traveler', true) RETURNING *`,
      [full_name.trim(), email.toLowerCase(), hash]);
    res.status(201).json({ token: sign(r.rows[0]), user: publicUser(r.rows[0]) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error.' }); }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const r = await db.query('SELECT * FROM users WHERE email = $1', [(email || '').toLowerCase()]);
    const u = r.rows[0];
    if (!u || !u.password_hash || !(await bcrypt.compare(password || '', u.password_hash)))
      return res.status(401).json({ error: 'Incorrect email or password.' });
    if (u.is_active === false) return res.status(403).json({ error: 'This account is suspended.' });
    await db.query('UPDATE users SET last_seen_at = now() WHERE user_id = $1', [u.user_id]);
    res.json({ token: sign(u), user: publicUser(u) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error.' }); }
});

router.post('/forgot-password', async (req, res) => {
  try {
    await ensureResetColumns();
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }

    const base = {
      ok: true,
      message: 'If that email is registered, a reset link has been generated.',
    };

    const r = await db.query('SELECT user_id, is_active FROM users WHERE email = $1', [email]);
    if (!r.rowCount || r.rows[0].is_active === false) {
      return res.json(base);
    }

    const userId = r.rows[0].user_id;
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    if (resetColsReady) {
      await db.query(
        'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE user_id = $3',
        [token, expires.toISOString(), userId]
      );
    } else {
      for (const [k, v] of memoryResetTokens.entries()) {
        if (v.userId === userId) memoryResetTokens.delete(k);
      }
      memoryResetTokens.set(token, { userId, expiresAt: expires.getTime() });
    }

    if (process.env.NODE_ENV !== 'production') {
      return res.json({
        ...base,
        devResetToken: token,
        devResetPath: `/reset-password?token=${token}`,
      });
    }
    res.json(base);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    await ensureResetColumns();
    const token = String(req.body.token || '').trim();
    const password = String(req.body.password || '');

    if (!token) return res.status(400).json({ error: 'Reset token is required.' });
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    let userId = null;
    if (resetColsReady) {
      const r = await db.query(
        'SELECT user_id FROM users WHERE reset_token = $1 AND reset_token_expires > now()',
        [token]
      );
      if (r.rowCount) userId = r.rows[0].user_id;
    } else {
      const entry = memoryResetTokens.get(token);
      if (entry && entry.expiresAt > Date.now()) {
        userId = entry.userId;
      }
    }

    if (!userId) {
      return res.status(400).json({ error: 'Reset link is invalid or has expired.' });
    }

    const hash = await bcrypt.hash(password, 10);
    if (resetColsReady) {
      await db.query(
        'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE user_id = $2',
        [hash, userId]
      );
    } else {
      await db.query('UPDATE users SET password_hash = $1 WHERE user_id = $2', [hash, userId]);
      memoryResetTokens.delete(token);
    }

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT users.*,
              (SELECT COUNT(*)::int FROM trips t WHERE t.user_id = users.user_id AND t.status::text <> 'cancelled') AS trips_count
       FROM users WHERE user_id = $1`,
      [req.user.id]
    );
    if (!r.rowCount) return res.status(404).json({ error: 'User not found.' });
    res.json(publicUser(r.rows[0]));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error.' }); }
});

module.exports = router;
module.exports.requireAuth = requireAuth;
