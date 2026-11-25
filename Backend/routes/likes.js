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

    const back = await db.query(`SELECT 1 FROM likes WHERE liker_id=$1 AND liked_id=$2 AND action='like'`, [other, me]);
    if (!back.rowCount) {
      await db.query(`INSERT INTO notifications (user_id, type, title, message) VALUES ($1,'like','New like','A traveler liked your trip.')`, [other]);
      return res.json({ matched: false });
    }

    const [a, b] = me < other ? [me, other] : [other, me];
    let conv = await db.query(`SELECT conversation_id FROM conversations WHERE user_one_id=$1 AND user_two_id=$2`, [a, b]);
    if (!conv.rowCount) {
      conv = await db.query(`INSERT INTO conversations (user_one_id, user_two_id) VALUES ($1,$2) RETURNING conversation_id`, [a, b]);
      await db.query(`UPDATE users SET matches_count = COALESCE(matches_count,0) + 1 WHERE user_id IN ($1,$2)`, [a, b]);
      for (const uid of [a, b])
        await db.query(`INSERT INTO notifications (user_id, type, title, message) VALUES ($1,'match','New match','You have a new travel match. Say hello.')`, [uid]);
    }
    res.json({ matched: true, conversation_id: conv.rows[0].conversation_id });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error.' }); }
});

router.get('/matches', async (req, res) => {
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
});

module.exports = router;
