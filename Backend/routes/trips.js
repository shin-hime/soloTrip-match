const router = require('express').Router();
const db = require('../db');
const { requireAuth } = require('./auth');
router.use(requireAuth);

function check(b) {
  if (!b.destination || !b.traveling_from) return 'Destination and starting location are required.';
  if (!b.departure_date || !b.return_date) return 'Both dates are required.';
  if (b.return_date < b.departure_date) return 'Return date cannot be before departure date.';
  return null;
}
const num = v => (v === '' || v == null) ? null : Number(v);

async function setRange(id, dep, ret) {
  // trip_dates is used by the matching engine; ignore if the column is auto-generated
  try { await db.query(`UPDATE trips SET trip_dates = daterange($2::date, $3::date, '[]') WHERE trip_id = $1`, [id, dep, ret]); }
  catch (e) { /* generated or absent column */ }
}

router.get('/mine', async (req, res) => {
  const r = await db.query(
    `SELECT trip_id, destination, traveling_from, departure_date::text, return_date::text,
            budget_usd, looking_for_count, status FROM trips
     WHERE user_id = $1 AND status::text <> 'cancelled' ORDER BY departure_date`, [req.user.id]);
  res.json(r.rows);
});

router.post('/', async (req, res) => {
  try {
    const b = req.body, err = check(b);
    if (err) return res.status(400).json({ error: err });
    const r = await db.query(
      `INSERT INTO trips (user_id, destination, traveling_from, departure_date, return_date, budget_usd, looking_for_count, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'open') RETURNING trip_id`,
      [req.user.id, b.destination.trim(), b.traveling_from.trim(), b.departure_date, b.return_date, num(b.budget_usd), num(b.looking_for_count)]);
    await setRange(r.rows[0].trip_id, b.departure_date, b.return_date);
    res.status(201).json({ trip_id: r.rows[0].trip_id });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error.' }); }
});

router.put('/:id', async (req, res) => {
  try {
    const b = req.body, err = check(b);
    if (err) return res.status(400).json({ error: err });
    const r = await db.query(
      `UPDATE trips SET destination=$1, traveling_from=$2, departure_date=$3, return_date=$4, budget_usd=$5, looking_for_count=$6
       WHERE trip_id=$7 AND user_id=$8 RETURNING trip_id`,
      [b.destination.trim(), b.traveling_from.trim(), b.departure_date, b.return_date, num(b.budget_usd), num(b.looking_for_count), req.params.id, req.user.id]);
    if (!r.rowCount) return res.status(404).json({ error: 'Trip not found.' });
    await setRange(req.params.id, b.departure_date, b.return_date);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error.' }); }
});

router.delete('/:id', async (req, res) => {
  const r = await db.query(`UPDATE trips SET status='cancelled' WHERE trip_id=$1 AND user_id=$2`, [req.params.id, req.user.id]);
  if (!r.rowCount) return res.status(404).json({ error: 'Trip not found.' });
  res.json({ ok: true });
});

module.exports = router;
