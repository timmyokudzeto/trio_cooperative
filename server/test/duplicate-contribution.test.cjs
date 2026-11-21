const test = require("node:test");
const assert = require("node:assert/strict");

const api = "http://127.0.0.1:3000/api";

test("paying twice keeps the round total and activity list unchanged", async () => {
  const {
    TRIO_TEST_EMAIL: email,
    TRIO_TEST_PASSWORD: password,
    TRIO_TEST_GROUP_ID: groupId,
    TRIO_TEST_ROUND_ID: roundId,
  } = process.env;

  assert.ok(email && password, "Set the test login details first.");
  assert.ok(groupId && roundId, "Set the circle ID and round ID first.");

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

  async function read(path) {
    const response = await fetch(`${api}${path}`, { headers });
    assert.equal(response.status, 200, `Could not read ${path}`);
    return response.json();
  }

  const roundPath = `/rounds/${roundId}`;
  const activityPath = `/groups/${groupId}/activity`;

  const { user } = await read("/users/me");
  const { round: before } = await read(roundPath);
  const { cycle } = await read(`/groups/${groupId}/cycles/${before.cycle_id}`);
  assert.equal(cycle.status, "active", "Choose a round in an active cycle.");
  assert.equal(before.payout_paid_at, null, "Choose a round awaiting payout.");

  const member = before.members.find(
    (person) => String(person.user_id) === String(user.id)
  );
  assert.equal(member?.paid, true, "Alex must already have paid for this round.");

  const activityBefore = await read(activityPath);

  const retry = await fetch(`${api}${roundPath}/contributions`, {
    method: "POST",
    headers,
  });
  assert.equal(retry.status, 409, "A second payment should be rejected.");

  const { round: after } = await read(roundPath);
  const activityAfter = await read(activityPath);

  assert.equal(after.collected_pence, before.collected_pence);
  assert.equal(after.paid_count, before.paid_count);
  assert.deepEqual(activityAfter.activity, activityBefore.activity);
});