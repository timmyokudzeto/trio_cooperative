const pool = require("../db.cjs");
const { validatePayoutOrder } = require("../domain/cycles.cjs");

async function startCycle(groupId, userId, contributionPence, rounds) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Let one start request at a time choose this group's next cycle number.
    await client.query(
      "SELECT id FROM public.groups WHERE id = $1 FOR UPDATE",
      [groupId]
    );

    const members = await client.query(
      `SELECT user_id, role
       FROM public.memberships
       WHERE group_id = $1 AND left_at IS NULL
       FOR SHARE`,
      [groupId]
    );

    const actor = members.rows.find(
      (member) => String(member.user_id) === String(userId)
    );

    if (actor?.role !== "admin") {
      await client.query("ROLLBACK");
      return { status: 403, error: "Only a circle admin can start a cycle." };
    }

    const memberIds = members.rows.map((member) => member.user_id);
    const payoutOrder = rounds.map((round) => round.userId);
    const orderError = validatePayoutOrder(memberIds, payoutOrder);

    if (orderError) {
      await client.query("ROLLBACK");
      return { status: 400, error: orderError };
    }

    const activeCycle = await client.query(
      `SELECT id FROM public.cycles
       WHERE group_id = $1 AND status = 'active'`,
      [groupId]
    );

    if (activeCycle.rowCount > 0) {
      await client.query("ROLLBACK");
      return { status: 409, error: "This circle already has an active cycle." };
    }

    const created = await client.query(
      `INSERT INTO public.cycles
         (group_id, cycle_number, contribution_pence, status)
       SELECT $1, COALESCE(MAX(cycle_number), 0) + 1, $2, 'active'
       FROM public.cycles
       WHERE group_id = $1
       RETURNING id, group_id, cycle_number, contribution_pence, status`,
      [groupId, contributionPence]
    );

    const cycle = created.rows[0];

    for (const [index, round] of rounds.entries()) {
      await client.query(
        `INSERT INTO public.rounds
           (group_id, cycle_id, recipient_user_id, payout_position, due_on)
         VALUES ($1, $2, $3, $4, $5)`,
        [groupId, cycle.id, round.userId, index + 1, round.dueOn]
      );
    }

    await client.query("COMMIT");
    return { cycle };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { startCycle };
async function findCycleForUser(groupId, cycleId, userId) {
  const result = await pool.query(
    `SELECT c.id, c.group_id, c.cycle_number, c.contribution_pence, c.status
     FROM public.cycles AS c
     JOIN public.memberships AS m ON m.group_id = c.group_id
     WHERE c.group_id = $1
       AND c.id = $2
       AND m.user_id = $3
       AND m.left_at IS NULL`,
    [groupId, cycleId, userId]
  );

  const cycle = result.rows[0];
  if (!cycle) return null;

  const rounds = await pool.query(
    `SELECT r.id, r.payout_position, r.recipient_user_id,
            u.display_name AS recipient_name, r.due_on::text AS due_on
     FROM public.rounds AS r
     JOIN public.users AS u ON u.id = r.recipient_user_id
     WHERE r.group_id = $1 AND r.cycle_id = $2
     ORDER BY r.payout_position`,
    [groupId, cycleId]
  );

  return { ...cycle, rounds: rounds.rows };
}

module.exports.findCycleForUser = findCycleForUser;