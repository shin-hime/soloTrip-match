const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const sign = u => jwt.sign({ id: u.user_id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
const publicUser = u => ({ user_id: u.user_id, full_name: u.full_name, email: u.email, role: u.role, avatar_url: u.avatar_url });

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

router.get('/me', requireAuth, async (req, res) => {
  const r = await db.query('SELECT * FROM users WHERE user_id = $1', [req.user.id]);
  if (!r.rowCount) return res.status(404).json({ error: 'User not found.' });
  res.json(publicUser(r.rows[0]));
});

module.exports = router;
module.exports.requireAuth = requireAuth;
