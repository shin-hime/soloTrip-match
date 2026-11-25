const router = require('express').Router();
const db = require('../db');
const { requireAuth } = require('./auth');
router.use(requireAuth);

const FIELDS = 'user_id, full_name, email, age, origin_location, avatar_url, bio, budget_range, travel_styles, interests, hide_contact_info';
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

module.exports = router;
