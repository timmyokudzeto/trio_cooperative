const pool = require("../db.cjs");

async function getRoundForUser(roundId, userId) {
  const result = await pool.query(
    `SELECT r.id, r.cycle_id, r.payout_position, r.due_on::text AS due_on,
            r.recipient_user_id, recipient.display_name AS recipient_name,
            c.status AS cycle_status, c.contribution_pence,
            payout.paid_at AS payout_paid_at,
            participant.id AS member_id, participant.display_name,
            payment.received_at
     FROM public.rounds AS r
     JOIN public.cycles AS c ON c.id = r.cycle_id
     JOIN public.users AS recipient ON recipient.id = r.recipient_user_id
     JOIN public.memberships AS viewer
       ON viewer.group_id = r.group_id
      AND viewer.user_id = $2
      AND viewer.left_at IS NULL
     JOIN public.rounds AS schedule ON schedule.cycle_id = r.cycle_id
     JOIN public.users AS participant ON participant.id = schedule.recipient_user_id
     LEFT JOIN public.contributions AS payment
       ON payment.round_id = r.id AND payment.member_user_id = participant.id
     LEFT JOIN public.payouts AS payout ON payout.round_id = r.id
     WHERE r.id = $1
     ORDER BY schedule.payout_position`,
    [roundId, userId]
  );

  if (result.rows.length === 0) return null;

  const round = result.rows[0];
  const members = result.rows.map((row) => ({
    user_id: row.member_id,
    display_name: row.display_name,
    paid: row.received_at !== null,
    received_at: row.received_at,
  }));

  const paidCount = members.filter((member) => member.paid).length;

  return {
    id: round.id,
    cycle_id: round.cycle_id,
    payout_position: round.payout_position,
    due_on: round.due_on,
    recipient_name: round.recipient_name,
    contribution_pence: round.contribution_pence,
    paid_count: paidCount,
    member_count: members.length,
    collected_pence: paidCount * round.contribution_pence,
    target_pence: members.length * round.contribution_pence,
    payout_eligible:
      round.cycle_status === "active" &&
      round.payout_paid_at === null &&
      paidCount === members.length,
    payout_paid_at: round.payout_paid_at,
    members,
  };
}

module.exports = { getRoundForUser };