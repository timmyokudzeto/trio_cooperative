const { z } = require("zod");
const { recordPayout } = require("../services/payouts.cjs");

const roundIdSchema = z.string()
  .regex(/^[1-9]\d{0,18}$/)
  .refine((id) => id.length < 19 || id <= "9223372036854775807");

async function createPayout(req, res) {
  const input = roundIdSchema.safeParse(req.params.roundId);

  if (!input.success) {
    return res.status(400).json({ error: "Invalid round ID." });
  }

  const result = await recordPayout(input.data, req.session.userId);
  return res.status(result.status).json(result.body);
}

module.exports = { createPayout };