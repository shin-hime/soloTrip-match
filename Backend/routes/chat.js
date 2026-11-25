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
    await db.query(`INSERT INTO direct_messages (conversation_id, sender_id, receiver_id, content) VALUES ($1,$2,$3,$4)`,
      [req.params.id, req.user.id, other, content]);
    await db.query(`UPDATE conversations SET last_message_text=$2, last_message_at=now() WHERE conversation_id=$1`, [req.params.id, content.slice(0, 120)]);
    const n = await db.query(`SELECT 1 FROM notifications WHERE user_id=$1 AND type='message' AND is_read IS NOT TRUE`, [other]);
    if (!n.rowCount)
      await db.query(`INSERT INTO notifications (user_id, type, title, message) VALUES ($1,'message','New message','You have a new message.')`, [other]);
    res.status(201).json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error.' }); }
});

module.exports = router;
