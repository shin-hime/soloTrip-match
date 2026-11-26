const router = require('express').Router();
const db = require('../db');
const { requireAuth } = require('./auth');
router.use(requireAuth);
router.use(async (req, res, next) => {
  try {
    const r = await db.query('SELECT role FROM users WHERE user_id = $1', [req.user.id]);
    if (!r.rowCount || String(r.rows[0].role || '').toLowerCase() !== 'admin') {
      return res.status(403).json({ error: 'Admins only.' });
    }
    next();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.get('/reports', async (req, res) => {
  try {
    const r = await db.query(
      `SELECT p.report_id, p.reporter_id, p.reason, p.status::text AS status, p.created_at,
              a.full_name AS reporter_name, u.user_id AS reported_user_id, u.full_name AS reported_name, u.is_active AS reported_active
       FROM user_reports p JOIN users a ON a.user_id = p.reporter_id JOIN users u ON u.user_id = p.reported_user_id
       ORDER BY (p.status::text = 'pending') DESC, p.created_at DESC LIMIT 100`);
    res.json(r.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.put('/reports/:id', async (req, res) => {
  try {
    const status = req.body.status;
    if (!['reviewed', 'resolved'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    const r = await db.query('UPDATE user_reports SET status=$1 WHERE report_id=$2 RETURNING reported_user_id', [status, req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: 'Report not found.' });
    if (req.body.suspend)
      await db.query(`UPDATE users SET is_active=false WHERE user_id=$1 AND role <> 'admin'`, [r.rows[0].reported_user_id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.put('/users/:id/active', async (req, res) => {
  try {
    await db.query(`UPDATE users SET is_active=$1 WHERE user_id=$2 AND role <> 'admin'`, [req.body.is_active === true, req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
