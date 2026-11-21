const pool = require("../db.cjs");

async function recordContribution(roundId, userId) {
  const result = await pool.query(
    `WITH recorded AS (
     INSERT INTO public.contributions (group_id, round_id, member_user_id)
     SELECT r.group_id, r.id, $2
     FROM public.rounds AS r
     JOIN public.cycles AS c ON c.id = r.cycle_id
     JOIN public.memberships AS m
       ON m.group_id = r.group_id AND m.user_id = $2
     WHERE r.id = $1
       AND c.status = 'active'
       AND m.left_at IS NULL
       AND EXISTS (
         SELECT 1
         FROM public.rounds AS schedule
         WHERE schedule.cycle_id = c.id
           AND schedule.recipient_user_id = m.user_id
       )
       AND r.id = (
         SELECT scheduled.id
         FROM public.rounds AS scheduled
         WHERE scheduled.cycle_id = c.id
           AND NOT EXISTS (
             SELECT 1
             FROM public.payouts AS p
             WHERE p.round_id = scheduled.id
           )
         ORDER BY scheduled.payout_position
         LIMIT 1
       )
     ON CONFLICT (round_id, member_user_id) DO NOTHING
       RETURNING group_id, round_id, member_user_id, received_at
),
logged AS (
  INSERT INTO public.audit_logs (group_id, actor_user_id, action, details)
  SELECT group_id, member_user_id, 'contribution_recorded',
         jsonb_build_object('round_id', round_id)
  FROM recorded
)
  SELECT round_id, member_user_id, received_at
     FROM recorded`,
    [roundId, userId]
  );

  return result.rows[0];
}

module.exports = { recordContribution };;