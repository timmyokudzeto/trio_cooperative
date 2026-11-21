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
async function verifyLogin(email, password) {
  const result = await pool.query(
    `SELECT id, display_name, email, password_hash
     FROM public.users
     WHERE lower(btrim(email)) = $1`,
    [email.trim().toLowerCase()]
  );

  const user = result.rows[0];

  if (!user || !user.password_hash) {
    return null;
  }

  const passwordMatches = await argon2.verify(user.password_hash, password);

  if (!passwordMatches) {
    return null;
  }

  return {
    id: user.id,
    displayName: user.display_name,
    email: user.email,
  };
}

module.exports.verifyLogin = verifyLogin;