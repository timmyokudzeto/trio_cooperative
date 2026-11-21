const { getRoundForUser } = require("../services/rounds.cjs");

async function getOne(req, res) {
  const { roundId } = req.params;

  if (!/^[1-9]\d{0,18}$/.test(roundId) ||
      BigInt(roundId) > 9223372036854775807n) {
    return res.status(400).json({ error: "Invalid round ID." });
  }

  const round = await getRoundForUser(roundId, req.session.userId);

  if (!round) {
    return res.status(404).json({ error: "Round not found." });
  }

  return res.json({ round });
}

module.exports = { getOne };