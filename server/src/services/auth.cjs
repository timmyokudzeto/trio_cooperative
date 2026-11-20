const argon2 = require("argon2");
const pool = require("../db.cjs");

async function registerUser({ displayName, email, password }) {
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
  });

  const result = await pool.query(
    `INSERT INTO public.users (display_name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, display_name, email`,
    [displayName, email, passwordHash]
  );

  return result.rows[0];
}

module.exports = { registerUser };