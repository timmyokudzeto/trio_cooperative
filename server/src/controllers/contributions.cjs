const { z } = require("zod");
const { recordContribution } = require("../services/contributions.cjs");

const roundIdSchema = z.string()
  .regex(/^[1-9]\d{0,18}$/)
  .refine((id) => id.length < 19 || id <= "9223372036854775807");

async function create(req, res) {
  const input = roundIdSchema.safeParse(req.params.roundId);

  if (!input.success) {
    return res.status(400).json({ error: "Invalid round ID." });
  }

  const contribution = await recordContribution(
    input.data,
    req.session.userId
  );

  if (!contribution) {
    return res.status(409).json({
      error: "You have already contributed, or this round is unavailable to you.",
    });
  }

  return res.status(201).json({ contribution });
}

module.exports = { create };