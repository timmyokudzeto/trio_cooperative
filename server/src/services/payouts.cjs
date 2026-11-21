const pool = require("../db.cjs");

async function recordPayout(roundId, userId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const access = await client.query(
      `SELECT c.id AS cycle_id, c.status, c.contribution_pence,
              r.recipient_user_id, m.role
       FROM public.rounds AS r
       JOIN public.cycles AS c ON c.id = r.cycle_id
       JOIN public.memberships AS m ON m.group_id = r.group_id
       WHERE r.id = $1 AND m.user_id = $2 AND m.left_at IS NULL
       FOR UPDATE OF c, m`,
      [roundId, userId]
    );

    const round = access.rows[0];

    if (!round) {
      await client.query("ROLLBACK");
      return { status: 404, body: { error: "Round not found." } };
    }

    if (round.role !== "admin") {
      await client.query("ROLLBACK");
      return { status: 403, body: { error: "Only a circle admin can record a payout." } };
    }

    const openRound = await client.query(
      `SELECT r.id
       FROM public.rounds AS r
       WHERE r.cycle_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM public.payouts AS p WHERE p.round_id = r.id
         )
       ORDER BY r.payout_position
       LIMIT 1`,
      [round.cycle_id]
    );

    if (round.status !== "active" || openRound.rows[0]?.id !== roundId) {
      await client.query("ROLLBACK");
      return { status: 409, body: { error: "This round is not open for payout." } };
    }

    const counts = await client.query(
      `SELECT COUNT(*)::int AS expected,
              COUNT(payment.round_id)::int AS paid
       FROM public.rounds AS schedule
       LEFT JOIN public.contributions AS payment
         ON payment.round_id = $1
        AND payment.member_user_id = schedule.recipient_user_id
       WHERE schedule.cycle_id = $2`,
      [roundId, round.cycle_id]
    );

    const { expected, paid } = counts.rows[0];

    if (paid !== expected) {
      await client.query("ROLLBACK");
      return {
        status: 409,
        body: { error: "Some members still need to contribute.", paid, expected },
      };
    }

    const amountPence = paid * round.contribution_pence;

    const result = await client.query(
      `INSERT INTO public.payouts (round_id, amount_pence)
       VALUES ($1, $2)
       RETURNING round_id, amount_pence, paid_at`,
      [roundId, amountPence]
    );

    await client.query(
      `UPDATE public.cycles AS c
       SET status = 'completed'
       WHERE c.id = $1
         AND NOT EXISTS (
           SELECT 1
           FROM public.rounds AS r
           WHERE r.cycle_id = c.id
             AND NOT EXISTS (
               SELECT 1 FROM public.payouts AS p WHERE p.round_id = r.id
             )
         )`,
      [round.cycle_id]
    );
    await client.query(
    `INSERT INTO public.audit_logs (group_id, actor_user_id, action, details)
    SELECT r.group_id, $2, 'payout_recorded',
            jsonb_build_object(
                'round_id', r.id,
                'recipient_user_id', r.recipient_user_id,
                'amount_pence', p.amount_pence
            )
    FROM public.rounds AS r
    JOIN public.payouts AS p ON p.round_id = r.id
    WHERE r.id = $1`,
    [roundId, userId]
    );
    await client.query("COMMIT");

    return {
      status: 201,
      body: {
        payout: { ...result.rows[0], recipient_user_id: round.recipient_user_id },
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { recordPayout };