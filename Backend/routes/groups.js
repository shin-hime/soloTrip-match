const router = require('express').Router();
const db = require('../db');
const { requireAuth } = require('./auth');
router.use(requireAuth);

const isMember = async (gid, uid) => (await db.query('SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2', [gid, uid])).rowCount > 0;

router.get('/', async (req, res) => {
  const dest = (req.query.destination || '').trim();
  const r = await db.query(
    `SELECT g.group_id, g.destination, g.start_date::text, g.end_date::text, g.max_members, g.creator_id, g.cover_image_url, g.created_at, u.full_name AS creator_name,
            (SELECT count(*)::int FROM group_members m WHERE m.group_id = g.group_id) AS member_count,
            COALESCE((SELECT json_agg(json_build_object('user_id', u2.user_id, 'full_name', u2.full_name, 'avatar_url', u2.avatar_url, 'role', m.role))
                      FROM group_members m JOIN users u2 ON u2.user_id = m.user_id WHERE m.group_id = g.group_id), '[]'::json) AS members,
            EXISTS (SELECT 1 FROM group_members m WHERE m.group_id = g.group_id AND m.user_id = $1) AS is_member
     FROM trip_groups g JOIN users u ON u.user_id = g.creator_id
     WHERE g.end_date >= current_date AND ($2 = '' OR g.destination ILIKE '%' || $2 || '%')
       AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=g.creator_id) OR (b.blocker_id=g.creator_id AND b.blocked_id=$1))
     ORDER BY g.start_date LIMIT 50`, [req.user.id, dest]);
  res.json(r.rows);
});

router.post('/', async (req, res) => {
  const b = req.body, max = parseInt(b.max_members, 10) || 6;
  if (!b.destination || !b.start_date || !b.end_date) return res.status(400).json({ error: 'Destination and dates are required.' });
  if (b.end_date < b.start_date) return res.status(400).json({ error: 'End date cannot be before start date.' });
  if (max < 2 || max > 20) return res.status(400).json({ error: 'Group size must be between 2 and 20.' });

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const g = await client.query(
      `INSERT INTO trip_groups (creator_id, destination, start_date, end_date, max_members)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING group_id, creator_id, destination, start_date::text, end_date::text, max_members, cover_image_url, created_at`,
      [req.user.id, b.destination.trim(), b.start_date, b.end_date, max]);
    await client.query(
      `INSERT INTO group_members (group_id, user_id, role) VALUES ($1,$2,'host')`,
      [g.rows[0].group_id, req.user.id]);
    const me = await client.query(`SELECT user_id, full_name, avatar_url FROM users WHERE user_id = $1`, [req.user.id]);
    await client.query('COMMIT');
    res.status(201).json({
      ...g.rows[0],
      member_count: 1,
      is_member: true,
      members: me.rowCount ? [{ ...me.rows[0], role: 'host' }] : [],
    });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(e);
    res.status(500).json({ error: 'Server error.' });
  } finally {
    client.release();
  }
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

router.get('/:id', async (req, res) => {
  try {
    const r = await db.query(
      `SELECT g.group_id, g.destination, g.start_date::text, g.end_date::text, g.max_members, g.creator_id, g.cover_image_url, g.created_at, u.full_name AS creator_name,
              (SELECT count(*)::int FROM group_members m WHERE m.group_id = g.group_id) AS member_count,
              COALESCE((SELECT json_agg(json_build_object('user_id', u2.user_id, 'full_name', u2.full_name, 'avatar_url', u2.avatar_url, 'role', m.role) ORDER BY m.joined_at ASC)
                        FROM group_members m JOIN users u2 ON u2.user_id = m.user_id WHERE m.group_id = g.group_id), '[]'::json) AS members,
              EXISTS (SELECT 1 FROM group_members m WHERE m.group_id = g.group_id AND m.user_id = $1) AS is_member
       FROM trip_groups g JOIN users u ON u.user_id = g.creator_id
       WHERE g.group_id = $2`, [req.user.id, req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: 'Group not found.' });
    res.json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error.' }); }
});

router.get('/:id/messages', async (req, res) => {
  if (!(await isMember(req.params.id, req.user.id))) return res.status(403).json({ error: 'Join the group first.' });
  const r = await db.query(
    `SELECT m.message_id, m.group_id, m.sender_id, u.full_name AS sender_name, u.avatar_url, m.content, m.sent_at
     FROM group_messages m JOIN users u ON u.user_id = m.sender_id
     WHERE m.group_id = $1 ORDER BY m.message_id DESC LIMIT 100`, [req.params.id]);
  res.json(r.rows.reverse());
});

router.post('/:id/messages', async (req, res) => {
  try {
    const content = (req.body.content || '').trim();
    if (!content || content.length > 1000) return res.status(400).json({ error: 'Message must be 1 to 1000 characters.' });
    if (!(await isMember(req.params.id, req.user.id))) return res.status(403).json({ error: 'Join the group first.' });
    const ins = await db.query(
      `INSERT INTO group_messages (group_id, sender_id, content) VALUES ($1,$2,$3)
       RETURNING message_id, group_id, sender_id, content, sent_at`,
      [req.params.id, req.user.id, content]);
    const u = await db.query('SELECT full_name AS sender_name, avatar_url FROM users WHERE user_id = $1', [req.user.id]);
    res.status(201).json({ ok: true, ...ins.rows[0], ...(u.rows[0] || {}) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error.' }); }
});

module.exports = router;
