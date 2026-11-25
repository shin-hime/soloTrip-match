const router = require('express').Router();
const db = require('../db');
const { requireAuth } = require('./auth');
router.use(requireAuth);

const isMember = async (gid, uid) => (await db.query('SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2', [gid, uid])).rowCount > 0;

router.get('/', async (req, res) => {
  const dest = (req.query.destination || '').trim();
  const r = await db.query(
    `SELECT g.group_id, g.destination, g.start_date::text, g.end_date::text, g.max_members, g.creator_id, u.full_name AS creator_name,
            (SELECT count(*)::int FROM group_members m WHERE m.group_id = g.group_id) AS member_count,
            EXISTS (SELECT 1 FROM group_members m WHERE m.group_id = g.group_id AND m.user_id = $1) AS is_member
     FROM trip_groups g JOIN users u ON u.user_id = g.creator_id
     WHERE g.end_date >= current_date AND ($2 = '' OR g.destination ILIKE '%' || $2 || '%')
       AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=g.creator_id) OR (b.blocker_id=g.creator_id AND b.blocked_id=$1))
     ORDER BY g.start_date LIMIT 50`, [req.user.id, dest]);
  res.json(r.rows);
});

router.post('/', async (req, res) => {
  try {
    const b = req.body, max = parseInt(b.max_members, 10) || 6;
    if (!b.destination || !b.start_date || !b.end_date) return res.status(400).json({ error: 'Destination and dates are required.' });
    if (b.end_date < b.start_date) return res.status(400).json({ error: 'End date cannot be before start date.' });
    if (max < 2 || max > 20) return res.status(400).json({ error: 'Group size must be between 2 and 20.' });
    const g = await db.query(
      `INSERT INTO trip_groups (creator_id, destination, start_date, end_date, max_members) VALUES ($1,$2,$3,$4,$5) RETURNING group_id`,
      [req.user.id, b.destination.trim(), b.start_date, b.end_date, max]);
    await db.query(`INSERT INTO group_members (group_id, user_id, role) VALUES ($1,$2,'owner')`, [g.rows[0].group_id, req.user.id]);
    res.status(201).json({ group_id: g.rows[0].group_id });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error.' }); }
});

router.post('/:id/join', async (req, res) => {
  try {
    const g = await db.query(
      `SELECT g.creator_id, g.max_members, (SELECT count(*)::int FROM group_members m WHERE m.group_id=g.group_id) AS n
       FROM trip_groups g WHERE g.group_id=$1`, [req.params.id]);
    if (!g.rowCount) return res.status(404).json({ error: 'Group not found.' });
    if (await isMember(req.params.id, req.user.id)) return res.json({ ok: true });
    if (g.rows[0].max_members && g.rows[0].n >= g.rows[0].max_members) return res.status(409).json({ error: 'This group is full.' });
    await db.query(`INSERT INTO group_members (group_id, user_id, role) VALUES ($1,$2,'member')`, [req.params.id, req.user.id]);
    await db.query(`INSERT INTO notifications (user_id, type, title, message) VALUES ($1,'group','Group update','A traveler joined your trip group.')`, [g.rows[0].creator_id]);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error.' }); }
});

router.post('/:id/leave', async (req, res) => {
  await db.query('DELETE FROM group_members WHERE group_id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

router.get('/:id/messages', async (req, res) => {
  if (!(await isMember(req.params.id, req.user.id))) return res.status(403).json({ error: 'Join the group first.' });
  const r = await db.query(
    `SELECT m.message_id, m.sender_id, u.full_name AS sender_name, m.content, m.sent_at
     FROM group_messages m JOIN users u ON u.user_id = m.sender_id
     WHERE m.group_id = $1 ORDER BY m.message_id DESC LIMIT 100`, [req.params.id]);
  res.json(r.rows.reverse());
});

router.post('/:id/messages', async (req, res) => {
  const content = (req.body.content || '').trim();
  if (!content || content.length > 1000) return res.status(400).json({ error: 'Message must be 1 to 1000 characters.' });
  if (!(await isMember(req.params.id, req.user.id))) return res.status(403).json({ error: 'Join the group first.' });
  await db.query('INSERT INTO group_messages (group_id, sender_id, content) VALUES ($1,$2,$3)', [req.params.id, req.user.id, content]);
  res.status(201).json({ ok: true });
});

module.exports = router;
