const test = require("node:test");
const assert = require("node:assert/strict");

test("a logged-out user cannot read circle activity", async () => {
  const response = await fetch(
    "http://127.0.0.1:3000/api/groups/1/activity"
  );

  assert.equal(response.status, 401);
});