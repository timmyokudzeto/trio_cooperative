const { getProfileById } = require("../services/users.cjs");

async function getMe(req, res) {
  const user = await getProfileById(req.session.userId);

  if (!user) {
    return res.status(401).json({ error: "Account no longer available." });
  }

  return res.status(200).json({ user });
}

module.exports = { getMe };