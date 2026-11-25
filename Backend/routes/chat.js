const router = require('express').Router();
const db = require('../db');
const { requireAuth } = require('./auth');
router.use(requireAuth);

async function otherUser(convId, me) {
  const r = await db.query('SELECT user_one_id, user_two_id FROM conversations WHERE conversation_id = $1', [convId]);
  if (!r.rowCount) return null;
  const c = r.rows[0];
  if (c.user_one_id !== me && c.user_two_id !== me) return null;
  const other = c.user_one_id === me ? c.user_two_id : c.user_one_id;
  const b = await db.query(
    `SELECT 1 FROM blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)`, [me, other]);
  return b.rowCount ? -1 : other;
}

router.get('/conversations', async (req, res) => {
  try {
    const me = req.user.id;
    const r = await db.query(
      `SELECT c.conversation_id, c.last_message_text, c.last_message_at,
              u.user_id, u.full_name, u.avatar_url,
              (SELECT t.destination FROM trips t WHERE t.user_id = u.user_id AND t.status::text IN ('open', 'active') ORDER BY t.departure_date LIMIT 1) AS destination,
              (SELECT count(*)::int FROM direct_messages m WHERE m.conversation_id = c.conversation_id AND m.receiver_id = $1 AND m.is_read IS NOT TRUE) AS unread_count
       FROM conversations c
       JOIN users u ON u.user_id = CASE WHEN c.user_one_id = $1 THEN c.user_two_id ELSE c.user_one_id END
       WHERE (c.user_one_id = $1 OR c.user_two_id = $1) AND u.is_active IS NOT FALSE
         AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=u.user_id) OR (b.blocker_id=u.user_id AND b.blocked_id=$1))
       ORDER BY COALESCE(c.last_message_at, c.created_at) DESC`, [me]);
    res.json(r.rows.map(row => ({
      conversation_id: row.conversation_id,
      other_user: {
        user_id: row.user_id,
        full_name: row.full_name,
        avatar_url: row.avatar_url,
        is_online: false,
        destination: row.destination || null,
      },
      last_message_text: row.last_message_text || null,
      last_message_at: row.last_message_at || null,
      unread_count: Number(row.unread_count || 0),
    })));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error.' }); }
});

router.get('/:id/messages', async (req, res) => {
  const other = await otherUser(req.params.id, req.user.id);
  if (!other || other === -1) return res.status(403).json({ error: 'Chat not available.' });
  const r = await db.query(
    `SELECT m.message_id, m.sender_id, u.full_name AS sender_name, m.content, m.sent_at
     FROM direct_messages m JOIN users u ON u.user_id = m.sender_id
     WHERE m.conversation_id = $1 ORDER BY m.message_id DESC LIMIT 100`, [req.params.id]);
  await db.query(`UPDATE direct_messages SET is_read = true WHERE conversation_id=$1 AND receiver_id=$2 AND is_read IS NOT TRUE`, [req.params.id, req.user.id]);
  res.json(r.rows.reverse());
});

router.post('/:id/messages', async (req, res) => {
  try {
    const content = (req.body.content || '').trim();
    if (!content || content.length > 1000) return res.status(400).json({ error: 'Message must be 1 to 1000 characters.' });
    const other = await otherUser(req.params.id, req.user.id);
    if (!other || other === -1) return res.status(403).json({ error: 'Chat not available.' });
    const ins = await db.query(
      `INSERT INTO direct_messages (conversation_id, sender_id, receiver_id, content) VALUES ($1,$2,$3,$4)
       RETURNING message_id, conversation_id, sender_id, receiver_id, content, is_read, sent_at`,
      [req.params.id, req.user.id, other, content]);
    await db.query(`UPDATE conversations SET last_message_text=$2, last_message_at=now() WHERE conversation_id=$1`, [req.params.id, content.slice(0, 120)]);
    const n = await db.query(`SELECT 1 FROM notifications WHERE user_id=$1 AND type='message' AND is_read IS NOT TRUE`, [other]);
    if (!n.rowCount)
      await db.query(`INSERT INTO notifications (user_id, type, title, message) VALUES ($1,'message','New message','You have a new message.')`, [other]);
    res.status(201).json({ ok: true, ...ins.rows[0] });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error.' }); }
});

module.exports = router;
