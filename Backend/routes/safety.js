const router = require('express').Router();
const db = require('../db');
const { requireAuth } = require('./auth');
router.use(requireAuth);

router.post('/report', async (req, res) => {
  try {
    const target = parseInt(req.body.user_id, 10), reason = (req.body.reason || '').trim();
    if (!target || target === req.user.id) return res.status(400).json({ error: 'Invalid user.' });
    if (reason.length < 3 || reason.length > 1000) return res.status(400).json({ error: 'Describe the reason (3 to 1000 characters).' });
    await db.query(`INSERT INTO user_reports (reporter_id, reported_user_id, reason, status) VALUES ($1,$2,$3,'pending')`, [req.user.id, target, reason]);
    res.status(201).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/block', async (req, res) => {
  try {
    const target = parseInt(req.body.user_id, 10);
    if (!target || target === req.user.id) return res.status(400).json({ error: 'Invalid user.' });
    await db.query('INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.id, target]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.get('/blocks', async (req, res) => {
  try {
    const r = await db.query(
      `SELECT u.user_id, u.full_name, u.avatar_url, b.created_at
       FROM blocks b JOIN users u ON u.user_id = b.blocked_id
       WHERE b.blocker_id = $1
       ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.delete(['/block/:id', '/blocks/:id'], async (req, res) => {
  try {
    const target = parseInt(req.params.id, 10);
    if (!target) return res.status(400).json({ error: 'Invalid user.' });
    await db.query('DELETE FROM blocks WHERE blocker_id=$1 AND blocked_id=$2', [req.user.id, target]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
