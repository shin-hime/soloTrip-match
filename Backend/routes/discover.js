const router = require('express').Router();
const db = require('../db');
const { requireAuth } = require('./auth');
router.use(requireAuth);

const norm = a => (Array.isArray(a) ? a : []).map(s => String(s).trim().toLowerCase()).filter(Boolean);
const shared = (a, b) => { const s = new Set(norm(b)); return [...new Set(norm(a))].filter(x => s.has(x)); };
const days = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000) + 1);

// Compatibility score out of 100: destination 40, date overlap 25, budget 15, interests 10, travel style 10
function score(my, other) {
  const ovStart = my.departure_date > other.departure_date ? my.departure_date : other.departure_date;
  const ovEnd = my.return_date < other.return_date ? my.return_date : other.return_date;
  const overlap = days(ovStart, ovEnd), mine = Math.max(1, days(my.departure_date, my.return_date));
  const dateScore = 25 * Math.min(1, overlap / mine);
  let budgetScore = 7;
  const a = Number(my.budget_usd), b = Number(other.budget_usd);
  if (a > 0 && b > 0) budgetScore = 15 * (Math.min(a, b) / Math.max(a, b));
  const si = shared(my.interests, other.interests), ss = shared(my.travel_styles, other.travel_styles);
  const total = 40 + dateScore + budgetScore + Math.min(10, si.length * 3.4) + Math.min(10, ss.length * 5);
  return { score: Math.round(total), overlap_days: overlap, shared_interests: si, shared_styles: ss };
}

router.get('/', async (req, res) => {
  try {
    const me = req.user.id, q = req.query;
    console.log("DISCOVER DEBUG:", {
  loggedInUserId: me,
  selectedTripId: q.trip_id
});
    const r = await db.query(
      `SELECT mt.trip_id AS my_trip_id, mt.departure_date::text AS my_dep, mt.return_date::text AS my_ret,
              mt.budget_usd AS my_budget, mi.interests AS my_interests, mi.travel_styles AS my_styles,
              u.user_id, u.full_name, u.age, u.origin_location, u.avatar_url, u.bio, u.budget_range,
              u.travel_styles, u.interests, u.rating,
              (SELECT COUNT(*)::int FROM trips t2 WHERE t2.user_id = u.user_id AND t2.status::text <> 'cancelled') AS trips_count,
              u.is_verified,
              t.trip_id, t.destination, t.departure_date::text AS departure_date, t.return_date::text AS return_date, t.budget_usd
       FROM trips mt
       JOIN users mi ON mi.user_id = mt.user_id
       JOIN trips t ON lower(trim(t.destination)) = lower(trim(mt.destination))
            AND t.departure_date <= mt.return_date AND t.return_date >= mt.departure_date
       JOIN users u ON u.user_id = t.user_id
       WHERE mt.user_id = $1 AND mt.status::text IN ('open', 'active')
         AND ($2::int IS NULL OR mt.trip_id = $2)
         AND t.user_id <> $1 AND t.status::text IN ('open', 'active') AND u.is_active IS NOT FALSE
         AND NOT EXISTS (SELECT 1 FROM likes l WHERE l.liker_id = $1 AND l.liked_id = u.user_id)
         AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = $1 AND b.blocked_id = u.user_id)
                                                    OR (b.blocker_id = u.user_id AND b.blocked_id = $1))`,
      [me, q.trip_id ? parseInt(q.trip_id, 10) : null]);
      console.log("MATCHING ROWS:", r.rows.length);
console.log("MATCHING USERS:", r.rows.map(row => row.user_id));
    const best = new Map();
    for (const row of r.rows) {
      const s = score(
        { departure_date: row.my_dep, return_date: row.my_ret, budget_usd: row.my_budget, interests: row.my_interests, travel_styles: row.my_styles },
        row);
      const card = {
        user_id: row.user_id, full_name: row.full_name, age: row.age, origin_location: row.origin_location,
        avatar_url: row.avatar_url, bio: row.bio, budget_range: row.budget_range, travel_styles: row.travel_styles || [],
        interests: row.interests || [], rating: Number(row.rating || 0), trips_count: Number(row.trips_count || 0), is_verified: row.is_verified,
        destination: row.destination, departure_date: row.departure_date, return_date: row.return_date, budget_usd: row.budget_usd, ...s };
      const cur = best.get(row.user_id);
      if (!cur || card.score > cur.score) best.set(row.user_id, card);
    }

    // Filters: age range, budget, interest, travel style
    const amin = q.age_min ? +q.age_min : null, amax = q.age_max ? +q.age_max : null, bmax = q.budget_max ? +q.budget_max : null;
    const interest = (q.interest || '').trim().toLowerCase(), style = (q.style || '').trim().toLowerCase();
    const out = [...best.values()].filter(c =>
      (amin == null || (c.age != null && c.age >= amin)) &&
      (amax == null || (c.age != null && c.age <= amax)) &&
      (bmax == null || c.budget_usd == null || Number(c.budget_usd) <= bmax) &&
      (!interest || norm(c.interests).includes(interest)) &&
      (!style || norm(c.travel_styles).includes(style))
    ).sort((a, b) => b.score - a.score).slice(0, 50);
    res.json(out);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error.' }); }
});

module.exports = router;
