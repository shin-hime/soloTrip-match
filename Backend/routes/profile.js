const router = require('express').Router();
const db = require('../db');
const { requireAuth } = require('./auth');
router.use(requireAuth);

const FIELDS = 'user_id, full_name, email, auth_provider, age, origin_location, avatar_url, cover_photo_url, bio, budget_range, rating, trips_count, matches_count, is_verified, hide_contact_info, last_seen_at, travel_styles, interests, is_active, role, created_at, updated_at';
const list = v => Array.isArray(v) ? v.map(s => String(s).trim()).filter(Boolean).slice(0, 15) : [];

router.get('/', async (req, res) => {
  const r = await db.query(`SELECT ${FIELDS} FROM users WHERE user_id = $1`, [req.user.id]);
  res.json(r.rows[0]);
});

router.put('/', async (req, res) => {
  try {
    const b = req.body;
    if (!b.full_name || !b.full_name.trim()) return res.status(400).json({ error: 'Name is required.' });
    const age = b.age === '' || b.age == null ? null : parseInt(b.age, 10);
    if (age !== null && (isNaN(age) || age < 16 || age > 100)) return res.status(400).json({ error: 'Enter a valid age.' });
    const r = await db.query(
      `UPDATE users SET full_name=$1, age=$2, origin_location=$3, bio=$4, budget_range=$5,
         travel_styles=$6, interests=$7, avatar_url=$8, hide_contact_info=$9, updated_at=now()
       WHERE user_id=$10 RETURNING ${FIELDS}`,
      [b.full_name.trim(), age, b.origin_location || null, b.bio || null, b.budget_range || null,
       list(b.travel_styles), list(b.interests), b.avatar_url || null, b.hide_contact_info !== false, req.user.id]);
    res.json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error.' }); }
});

router.patch('/', async (req, res) => {
  try {
    const b = req.body;
    const cur = await db.query(`SELECT ${FIELDS} FROM users WHERE user_id = $1`, [req.user.id]);
    if (!cur.rowCount) return res.status(404).json({ error: 'User not found.' });
    const u = cur.rows[0];
    const fullName = b.full_name !== undefined ? String(b.full_name).trim() : u.full_name;
    if (!fullName) return res.status(400).json({ error: 'Name is required.' });
    const age = b.age === undefined ? u.age : (b.age === '' || b.age == null ? null : parseInt(b.age, 10));
    if (age !== null && (isNaN(age) || age < 16 || age > 100)) return res.status(400).json({ error: 'Enter a valid age.' });
    const r = await db.query(
      `UPDATE users SET full_name=$1, age=$2, origin_location=$3, bio=$4, budget_range=$5,
         travel_styles=$6, interests=$7, avatar_url=$8, cover_photo_url=$9, hide_contact_info=$10, updated_at=now()
       WHERE user_id=$11 RETURNING ${FIELDS}`,
      [
        fullName,
        age,
        b.origin_location !== undefined ? (b.origin_location || null) : u.origin_location,
        b.bio !== undefined ? (b.bio || null) : u.bio,
        b.budget_range !== undefined ? (b.budget_range || null) : u.budget_range,
        b.travel_styles !== undefined ? list(b.travel_styles) : (u.travel_styles || []),
        b.interests !== undefined ? list(b.interests) : (u.interests || []),
        b.avatar_url !== undefined ? (b.avatar_url || null) : u.avatar_url,
        b.cover_photo_url !== undefined ? (b.cover_photo_url || null) : u.cover_photo_url,
        b.hide_contact_info !== undefined ? Boolean(b.hide_contact_info) : u.hide_contact_info,
        req.user.id,
      ]);
    res.json(r.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error.' }); }
});

module.exports = router;
