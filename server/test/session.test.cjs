const test = require("node:test");
const assert = require("node:assert/strict");

const api = "http://127.0.0.1:3000/api";

test("logging out ends the session that was used to log in", async () => {
  const email = process.env.TRIO_TEST_EMAIL;
  const password = process.env.TRIO_TEST_PASSWORD;
  assert.ok(email && password, "Set TRIO_TEST_EMAIL and TRIO_TEST_PASSWORD first.");

  const login = await fetch(`${api}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(login.status, 200, "Login should succeed");

  const sessionCookie = login.headers.getSetCookie()
    .find((cookie) => cookie.startsWith("trio.sid="));
  assert.ok(sessionCookie, "Login should return a trio.sid cookie");

  const headers = { Cookie: sessionCookie.split(";")[0] };

  const before = await fetch(`${api}/users/me`, { headers });
  assert.equal(before.status, 200, "Me should work before logout");

  const logout = await fetch(`${api}/auth/logout`, { method: "POST", headers });
  assert.ok([200, 204].includes(logout.status), `Logout returned ${logout.status}`);

  const after = await fetch(`${api}/users/me`, { headers });
  assert.equal(after.status, 401, "The old session should stop working after logout");
});