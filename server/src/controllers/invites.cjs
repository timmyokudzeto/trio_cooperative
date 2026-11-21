const { z } = require("zod");
const { joinWithInvite } = require("../services/invites.cjs");

const inviteCode = z.string().regex(/^[0-9a-f]{64}$/);

async function join(req, res) {
  const input = inviteCode.safeParse(req.params.code);

  if (!input.success) {
    return res.status(400).json({ error: "Invalid invite code." });
  }

  const membership = await joinWithInvite(input.data, req.session.userId);

  if (!membership) {
    return res.status(404).json({
      error: "This invite is unavailable for this account.",
    });
  }

  return res.status(200).json({ groupId: membership.groupId });
}

module.exports = { join };