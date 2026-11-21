const { z } = require("zod");
const {
  createGroup,
  listGroupsForUser,
  findGroupForUser,
  renameGroup,
  createInvite,
  listGroupMembers,
  changeMemberRole,
} = require("../services/groups.cjs");
const { startCycle } = require("../services/cycles.cjs");

const groupBody = z.object({
  name: z.string().trim().min(1),
});
const inviteBody = z.object({
  email: z.string().trim().email().toLowerCase(),
});

async function create(req, res) {
  const input = groupBody.safeParse(req.body);

  if (!input.success) {
    return res.status(400).json({
      error: "Enter a circle name.",
    });
  }

  const group = await createGroup(input.data.name, req.session.userId);

  return res.status(201).json({ group });
}

async function list(req, res) {
  const groups = await listGroupsForUser(req.session.userId);
  return res.json({ groups });
}

const groupIdSchema = z.string()
  .regex(/^[1-9]\d{0,18}$/)
  .pipe(z.coerce.bigint().max(9223372036854775807n));

async function getOne(req, res) {
  const input = groupIdSchema.safeParse(req.params.groupId);

  if (!input.success) {
    return res.status(400).json({ error: "Enter a valid circle ID." });
  }

  const group = await findGroupForUser(input.data, req.session.userId);

  if (!group) {
    return res.status(404).json({ error: "Circle not found." });
  }

  return res.json({ group });
}
async function rename(req, res) {
  const id = groupIdSchema.safeParse(req.params.groupId);
  if (!id.success) {
    return res.status(400).json({ error: "Enter a valid circle ID." });
  }

  const body = groupBody.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: "Enter a circle name." });
  }

  const group = await renameGroup(id.data, req.session.userId, body.data.name);

  if (!group) {
    return res.status(403).json({
      error: "You must be an admin of this circle to rename it.",
    });
  }

  return res.json({ group });
}
async function invite(req, res) {
  const id = groupIdSchema.safeParse(req.params.groupId);
  if (!id.success) {
    return res.status(400).json({ error: "Enter a valid circle ID." });
  }

  const body = inviteBody.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }

  const invitation = await createInvite(
    id.data,
    req.session.userId,
    body.data.email
  );

  if (!invitation) {
    return res.status(403).json({
      error: "You must be an admin of this circle to invite someone.",
    });
  }

  return res.status(201).json({ invite: invitation });
}
async function members(req, res) {
  const id = groupIdSchema.safeParse(req.params.groupId);

  if (!id.success) {
    return res.status(400).json({ error: "Enter a valid circle ID." });
  }

  const people = await listGroupMembers(id.data, req.session.userId);

  if (people.length === 0) {
    return res.status(404).json({ error: "Circle not found." });
  }

  return res.json({ members: people });
}
const memberRoleBody = z.object({
  role: z.enum(["admin", "member"]),
});

async function updateMember(req, res) {
  const groupId = groupIdSchema.safeParse(req.params.groupId);
  const memberId = groupIdSchema.safeParse(req.params.memberId);
  const body = memberRoleBody.safeParse(req.body);

  if (!groupId.success || !memberId.success) {
    return res.status(400).json({ error: "Enter valid circle and member IDs." });
  }

  if (!body.success) {
    return res.status(400).json({ error: "Choose admin or member." });
  }

  const result = await changeMemberRole(
    groupId.data,
    req.session.userId,
    memberId.data,
    body.data.role
  );

  if (result.error) {
    return res.status(result.status).json({ error: result.error });
  }

  return res.json({ member: result.member });
}
const cycleBody = z.object({
  contributionPence: z.number().int().min(1).max(2147483647),
  rounds: z.array(
    z.object({
      userId: groupIdSchema,
      dueOn: z.iso.date(),
    })
  ).max(20),
});

async function createCycle(req, res) {
  const groupId = groupIdSchema.safeParse(req.params.groupId);
  if (!groupId.success) {
    return res.status(400).json({ error: "Enter a valid circle ID." });
  }

  const body = cycleBody.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({
      error: "Enter a positive amount in pence and a schedule with user IDs and dates.",
    });
  }

  const { contributionPence, rounds } = body.data;
  const result = await startCycle(
    groupId.data,
    req.session.userId,
    contributionPence,
    rounds
  );

  if (result.error) {
    return res.status(result.status).json({ error: result.error });
  }

  return res.status(201).json({ cycle: result.cycle });
}
module.exports = { create, list, getOne, rename, invite, members, updateMember, createCycle };
const { findCycleForUser } = require("../services/cycles.cjs");

async function getCycle(req, res) {
  const groupId = groupIdSchema.safeParse(req.params.groupId);
  const cycleId = groupIdSchema.safeParse(req.params.cycleId);

  if (!groupId.success || !cycleId.success) {
    return res.status(400).json({ error: "Invalid circle or cycle ID." });
  }

  const cycle = await findCycleForUser(
    groupId.data,
    cycleId.data,
    req.session.userId
  );

  if (!cycle) {
    return res.status(404).json({ error: "Cycle not found." });
  }

  return res.json({ cycle });
}

module.exports.getCycle = getCycle;
const { listActivityForUser } = require("../services/groups.cjs");

async function getActivity(req, res) {
  const input = groupIdSchema.safeParse(req.params.groupId);

  if (!input.success) {
    return res.status(400).json({ error: "Invalid circle ID." });
  }

  const activity = await listActivityForUser(input.data, req.session.userId);

  if (activity === null) {
    return res.status(404).json({ error: "Circle not found." });
  }

  return res.json({ activity });
}

module.exports.getActivity = getActivity;