const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const pool = require("../src/db.cjs");
const { startCycle } = require("../src/services/cycles.cjs");
const { recordContribution } = require("../src/services/contributions.cjs");
const { recordPayout } = require("../src/services/payouts.cjs");

test("a funded round pays out exactly once", async () => {
  const userIds = [];
  let groupId;

  try {
    const db = await pool.query("SELECT current_database() AS name");
    assert.equal(db.rows[0].name, "trio_test", "Run this against trio_test.");

    // Give this run its own circle and four users.
    const runId = randomUUID();
    const group = await pool.query(
      "INSERT INTO public.groups (name) VALUES ($1) RETURNING id",
      [`Payout test ${runId}`]
    );
    groupId = group.rows[0].id;

    for (const name of ["Alex", "Sam", "Jo", "Lee"]) {
      const user = await pool.query(
        `INSERT INTO public.users (display_name, email, password_hash)
         VALUES ($1, $2, $3) RETURNING id`,
        [name, `${name.toLowerCase()}-${runId}@example.com`, "unused-in-service-test"]
      );
      const userId = user.rows[0].id;
      userIds.push(userId);

      await pool.query(
        `INSERT INTO public.memberships (group_id, user_id, role)
         VALUES ($1, $2, $3)`,
        [groupId, userId, name === "Alex" ? "admin" : "member"]
      );
    }

    // Use the same services that your Express routes call.
    const alexId = userIds[0];
    const schedule = userIds.map((userId, index) => ({
      userId,
      dueOn: `2030-01-${String(index + 1).padStart(2, "0")}`,
    }));

    const started = await startCycle(groupId, alexId, 5000, schedule);
    assert.ok(started.cycle, started.error);

    const rounds = await pool.query(
      `SELECT id FROM public.rounds
       WHERE cycle_id = $1 AND payout_position = 1`,
      [started.cycle.id]
    );
    const roundId = rounds.rows[0].id;

  // Alex pays first, then tries to pay again.
const firstPayment = await recordContribution(roundId, alexId);
assert.ok(firstPayment, "Alex's first contribution should succeed.");

const duplicate = await recordContribution(roundId, alexId);
assert.equal(duplicate, undefined, "Alex's second contribution should be rejected.");

// PostgreSQL should contain one contribution and one activity entry.
const payments = await pool.query(
  "SELECT member_user_id FROM public.contributions WHERE round_id = $1",
  [roundId]
);
assert.equal(payments.rowCount, 1);
assert.equal(payments.rows[0].member_user_id, alexId);

const paymentEvents = await pool.query(
  `SELECT id FROM public.audit_logs
   WHERE group_id = $1 AND action = 'contribution_recorded'`,
  [groupId]
);
assert.equal(paymentEvents.rowCount, 1);

// Alex is an admin, but only £50 of the £200 has been collected.
const earlyPayout = await recordPayout(roundId, alexId);
assert.equal(earlyPayout.status, 409);
assert.equal(earlyPayout.body.paid, 1);
assert.equal(earlyPayout.body.expected, 4);

const savedPayouts = await pool.query(
  "SELECT round_id FROM public.payouts WHERE round_id = $1",
  [roundId]
);
assert.equal(savedPayouts.rowCount, 0, "An early payout must leave no payout row.");

// Now the other three members pay.
for (const userId of userIds.slice(1)) {
  const contribution = await recordContribution(roundId, userId);
  assert.ok(contribution, "Each remaining member's contribution should succeed.");
}
const samId = userIds[1];
const memberPayout = await recordPayout(roundId, samId);
assert.equal(memberPayout.status, 403, "Only a circle admin can record a payout.");
    // Two payout requests arrive together, like a quick double-click.
    const results = await Promise.all([
      recordPayout(roundId, alexId),
      recordPayout(roundId, alexId),
    ]);
    const statuses = results.map((result) => result.status).sort();
    assert.deepEqual(statuses, [201, 409]);

    // Check what PostgreSQL actually saved.
    const payouts = await pool.query(
      "SELECT amount_pence FROM public.payouts WHERE round_id = $1",
      [roundId]
    );
    assert.equal(payouts.rowCount, 1);
    assert.equal(Number(payouts.rows[0].amount_pence), 20000);

    const events = await pool.query(
      `SELECT actor_user_id FROM public.audit_logs
       WHERE group_id = $1 AND action = 'payout_recorded'`,
      [groupId]
    );
    assert.equal(events.rowCount, 1);
const remainingRounds = await pool.query(
  `SELECT id, recipient_user_id
   FROM public.rounds
   WHERE cycle_id = $1 AND payout_position > 1
   ORDER BY payout_position`,
  [started.cycle.id]
);
assert.equal(remainingRounds.rowCount, 3);

for (const round of remainingRounds.rows) {
  for (const userId of userIds) {
    const payment = await recordContribution(round.id, userId);
    assert.ok(payment, "Each member should be able to pay into the next round.");
  }

  // Even when everyone has paid, the cycle stays active until payout.
  const before = await pool.query(
    "SELECT status FROM public.cycles WHERE id = $1",
    [started.cycle.id]
  );
  assert.equal(before.rows[0].status, "active");

  const result = await recordPayout(round.id, alexId);
  assert.equal(result.status, 201);
  assert.equal(result.body.payout.recipient_user_id, round.recipient_user_id);
  assert.equal(Number(result.body.payout.amount_pence), 20000);
}

const finished = await pool.query(
  "SELECT status FROM public.cycles WHERE id = $1",
  [started.cycle.id]
);
assert.equal(finished.rows[0].status, "completed");
  } finally {
    // Remove only this run's records so the test can run again.
    try {
      if (groupId) {
        await pool.query("DELETE FROM public.audit_logs WHERE group_id = $1", [groupId]);
        await pool.query(
          `DELETE FROM public.payouts WHERE round_id IN
           (SELECT id FROM public.rounds WHERE group_id = $1)`,
          [groupId]
        );
        await pool.query("DELETE FROM public.contributions WHERE group_id = $1", [groupId]);
        await pool.query("DELETE FROM public.rounds WHERE group_id = $1", [groupId]);
        await pool.query("DELETE FROM public.cycles WHERE group_id = $1", [groupId]);
        await pool.query("DELETE FROM public.memberships WHERE group_id = $1", [groupId]);
        await pool.query("DELETE FROM public.groups WHERE id = $1", [groupId]);
        await pool.query("DELETE FROM public.users WHERE id = ANY($1::bigint[])", [userIds]);
      }
    } finally {
      await pool.end();
    }
  }
});