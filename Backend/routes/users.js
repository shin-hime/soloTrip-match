const router = require('express').Router();
const db = require('../db');
const { requireAuth } = require('./auth');
router.use(requireAuth);

router.get('/:id', async (req, res) => {
  try {
    const me = req.user.id;
    const target = parseInt(req.params.id, 10);
    if (!target) return res.status(400).json({ error: 'Invalid user ID.' });

    const userRes = await db.query(
      `SELECT user_id, full_name, email, age, origin_location, avatar_url, cover_photo_url,
              bio, budget_range, rating, trips_count, matches_count, is_verified,
              hide_contact_info, travel_styles, interests, is_active
       FROM users
       WHERE user_id = $1`,
      [target]
    );
    if (!userRes.rowCount || userRes.rows[0].is_active === false) {
      return res.status(404).json({ error: 'Traveler not found.' });
    }
    const u = userRes.rows[0];

    const [blockRes, convRes, likesRes, tripsRes] = await Promise.all([
      db.query(
        `SELECT 1 FROM blocks WHERE blocker_id = $1 AND blocked_id = $2`,
        [me, target]
      ),
      db.query(
        `SELECT conversation_id FROM conversations
         WHERE user_one_id = LEAST($1::int, $2::int) AND user_two_id = GREATEST($1::int, $2::int)`,
        [me, target]
      ),
      db.query(
        `SELECT liker_id, liked_id, action FROM likes
         WHERE ((liker_id = $1 AND liked_id = $2) OR (liker_id = $2 AND liked_id = $1))
           AND action = 'like'`,
        [me, target]
      ),
      db.query(
        `SELECT trip_id, user_id, destination, traveling_from,
                departure_date::text AS departure_date, return_date::text AS return_date,
                budget_usd, looking_for_count, status, created_at
         FROM trips
         WHERE user_id = $1 AND status::text IN ('open', 'active')
         ORDER BY departure_date ASC`,
        [target]
      ),
    ]);

    const is_blocked = blockRes.rowCount > 0;
    const is_matched = convRes.rowCount > 0;
    const conversation_id = is_matched ? convRes.rows[0].conversation_id : null;

    const iLiked = likesRes.rows.some((r) => r.liker_id === me && r.liked_id === target);
    const theyLiked = likesRes.rows.some((r) => r.liker_id === target && r.liked_id === me);
    const request_status = iLiked ? 'sent' : theyLiked ? 'received' : 'none';

    const hideContact = Boolean(u.hide_contact_info);
    const isAdmin = String(req.user.role || '').toLowerCase() === 'admin';
    const canSeeContact = !hideContact || me === u.user_id || isAdmin;

    res.json({
      user_id: u.user_id,
      full_name: u.full_name,
      age: u.age,
      origin_location: u.origin_location,
      avatar_url: u.avatar_url,
      cover_photo_url: u.cover_photo_url,
      bio: u.bio,
      travel_styles: Array.isArray(u.travel_styles) ? u.travel_styles : [],
      budget_range: u.budget_range,
      interests: Array.isArray(u.interests) ? u.interests : [],
      rating: Number(u.rating || 0),
      trips_count: Number(u.trips_count || 0),
      matches_count: Number(u.matches_count || 0),
      is_verified: Boolean(u.is_verified),
      hide_contact_info: hideContact,
      email: canSeeContact ? u.email : null,
      contact_info: canSeeContact ? u.email : null,
      trips: tripsRes.rows,
      is_blocked,
      is_matched,
      conversation_id,
      request_status,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.delete('/:id/request', async (req, res) => {
  try {
    const me = req.user.id;
    const target = parseInt(req.params.id, 10);
    if (!target || target === me) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }

    const conv = await db.query(
      `SELECT 1 FROM conversations
       WHERE user_one_id = LEAST($1::int, $2::int) AND user_two_id = GREATEST($1::int, $2::int)`,
      [me, target]
    );
    if (conv.rowCount) {
      return res.status(409).json({ error: 'You are already matched with this traveler.' });
    }

    await db.query(
      `DELETE FROM likes WHERE liker_id = $1 AND liked_id = $2 AND action = 'like'`,
      [me, target]
    );

    const senderRes = await db.query('SELECT full_name FROM users WHERE user_id = $1', [me]);
    const senderName = senderRes.rows[0]?.full_name;
    if (senderName) {
      await db.query(
        `DELETE FROM notifications
         WHERE user_id = $1
           AND title = 'New chat request'
           AND message = $2
           AND is_read IS NOT TRUE`,
        [target, `${senderName} sent you a chat request.`]
      );
    }

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
