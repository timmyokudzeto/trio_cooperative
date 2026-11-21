const test = require("node:test");
const assert = require("node:assert/strict");

const api = "http://127.0.0.1:3000/api";

test("an admin cannot pay out a round while members still owe money", async () => {
  const email = process.env.TRIO_TEST_EMAIL;
  const password = process.env.TRIO_TEST_PASSWORD;
  const roundId = process.env.TRIO_TEST_ROUND_ID;

  assert.ok(email && password && roundId, "Set the test login and round ID first.");

  const login = await fetch(`${api}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(login.status, 200, "Alex should be able to log in.");

  const cookie = login.headers.getSetCookie()
    .find((value) => value.startsWith("trio.sid="));
  assert.ok(cookie, "Login should return a session cookie.");
  const headers = { Cookie: cookie.split(";")[0] };

  const roundUrl = `${api}/rounds/${roundId}`;

  async function readRound() {
    const response = await fetch(roundUrl, { headers });
    assert.equal(response.status, 200, "Alex should be able to read the round.");
    return (await response.json()).round;
  }

  const before = await readRound();
  assert.equal(before.payout_paid_at, null, "Choose a round awaiting payout.");
  assert.ok(
    before.paid_count < before.member_count,
    "Choose a round where at least one member still owes money."
  );

  const payout = await fetch(`${roundUrl}/payout`, { method: "POST", headers });
  assert.equal(payout.status, 409, "Trio should reject an early payout.");
  assert.deepEqual(await payout.json(), {
    error: "Some members still need to contribute.",
    paid: before.paid_count,
    expected: before.member_count,
  });

  const after = await readRound();
  assert.equal(after.payout_paid_at, null, "The payout should still be pending.");
  assert.equal(after.collected_pence, before.collected_pence);
});