const router = require('express').Router();
const db = require('../db');
const { requireAuth } = require('./auth');
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const items = await db.query(
      `SELECT notification_id, type, title, message, is_read, created_at FROM notifications
       WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30`, [req.user.id]);
    const c = await db.query(`SELECT count(*)::int AS n FROM notifications WHERE user_id=$1 AND is_read IS NOT TRUE`, [req.user.id]);
    res.json({ unread: c.rows[0].n, items: items.rows });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error.' }); }
});

router.post('/read-all', async (req, res) => {
  try {
    await db.query(`UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read IS NOT TRUE`, [req.user.id]);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error.' }); }
});

module.exports = router;
