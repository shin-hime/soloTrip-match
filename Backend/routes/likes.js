const router = require('express').Router();
const db = require('../db');
const { requireAuth } = require('./auth');
router.use(requireAuth);

// Like or skip a traveler. A match is created only when both users like each other.
router.post('/', async (req, res) => {
  try {
    const me = req.user.id, other = parseInt(req.body.user_id, 10), action = req.body.action;
    if (!other || other === me || !['like', 'skip'].includes(action)) return res.status(400).json({ error: 'Invalid request.' });
    const blocked = await db.query(
      `SELECT 1 FROM blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)`, [me, other]);
    if (blocked.rowCount) return res.status(403).json({ error: 'Not allowed.' });

    await db.query(
      `INSERT INTO likes (liker_id, liked_id, action) VALUES ($1,$2,$3)
       ON CONFLICT (liker_id, liked_id) DO UPDATE SET action = EXCLUDED.action, created_at = now()`, [me, other, action]);
    if (action === 'skip') return res.json({ matched: false });

    const senderRes = await db.query('SELECT full_name FROM users WHERE user_id = $1', [me]);
    const senderName = senderRes.rows[0]?.full_name || 'A traveler';
    const io = req.app.get('io');

    const back = await db.query(`SELECT 1 FROM likes WHERE liker_id=$1 AND liked_id=$2 AND action='like'`, [other, me]);
    if (!back.rowCount) {
      const note = await db.query(
        `INSERT INTO notifications (user_id, type, title, message)
         VALUES ($1, 'like', 'New chat request', $2)
         RETURNING notification_id, type, title, message, is_read, created_at`,
        [other, `${senderName} sent you a chat request.`]
      );
      if (io && note.rows[0]) {
        io.to(`user:${other}`).emit('notification:new', note.rows[0]);
      }
      return res.json({ matched: false });
    }

    const [a, b] = me < other ? [me, other] : [other, me];
    let conv = await db.query(`SELECT conversation_id FROM conversations WHERE user_one_id=$1 AND user_two_id=$2`, [a, b]);
    if (!conv.rowCount) {
      conv = await db.query(`INSERT INTO conversations (user_one_id, user_two_id) VALUES ($1,$2) RETURNING conversation_id`, [a, b]);
      await db.query(`UPDATE users SET matches_count = COALESCE(matches_count,0) + 1 WHERE user_id IN ($1,$2)`, [a, b]);
      for (const uid of [a, b]) {
        const note = await db.query(
          `INSERT INTO notifications (user_id, type, title, message)
           VALUES ($1,'match','New match','You have a new travel match. Say hello.')
           RETURNING notification_id, type, title, message, is_read, created_at`,
          [uid]
        );
        if (io && note.rows[0]) {
          io.to(`user:${uid}`).emit('notification:new', note.rows[0]);
        }
      }
    }
    res.json({ matched: true, conversation_id: conv.rows[0].conversation_id });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error.' }); }
});

// Pending incoming chat requests (users who liked me that I haven't accepted or declined yet)
router.get('/incoming', async (req, res) => {
  try {
    const me = req.user.id;
    const r = await db.query(
      `SELECT l.like_id, u.user_id, u.full_name, u.avatar_url, u.origin_location, l.created_at,
              (SELECT t.destination FROM trips t
               WHERE t.user_id = u.user_id AND t.status::text IN ('open', 'active')
               ORDER BY t.departure_date ASC LIMIT 1) AS destination
       FROM likes l
       JOIN users u ON u.user_id = l.liker_id
       WHERE l.liked_id = $1 AND l.action = 'like' AND u.is_active IS NOT FALSE
         AND NOT EXISTS (SELECT 1 FROM likes l2 WHERE l2.liker_id = $1 AND l2.liked_id = l.liker_id)
         AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = $1 AND b.blocked_id = u.user_id)
                                                   OR (b.blocker_id = u.user_id AND b.blocked_id = $1))
       ORDER BY l.created_at DESC`,
      [me]
    );
    res.json(r.rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error.' }); }
});

router.get('/matches', async (req, res) => {
  try {
    const me = req.user.id;
    const r = await db.query(
      `SELECT u.user_id, u.full_name, u.age, u.origin_location, u.avatar_url, u.bio, u.interests, u.travel_styles,
              CASE WHEN u.hide_contact_info IS FALSE THEN u.email ELSE NULL END AS email,
              c.conversation_id
       FROM likes l1
       JOIN likes l2 ON l2.liker_id = l1.liked_id AND l2.liked_id = l1.liker_id AND l2.action = 'like'
       JOIN users u ON u.user_id = l1.liked_id
       LEFT JOIN conversations c ON c.user_one_id = LEAST($1::int, u.user_id) AND c.user_two_id = GREATEST($1::int, u.user_id)
       WHERE l1.liker_id = $1 AND l1.action = 'like' AND u.is_active IS NOT FALSE
         AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=u.user_id) OR (b.blocker_id=u.user_id AND b.blocked_id=$1))
       ORDER BY l1.created_at DESC`, [me]);
    res.json(r.rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error.' }); }
});

module.exports = router;
