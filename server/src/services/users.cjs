const pool = require("../db.cjs");

async function getProfileById(userId) {
  const result = await pool.query(
    `SELECT id, email, display_name AS "displayName"
     FROM public.users
     WHERE id = $1`,
    [userId]
  );

  return result.rows[0];
}

module.exports = { getProfileById };