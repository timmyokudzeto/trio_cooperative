const test = require("node:test");
const assert = require("node:assert/strict");
const { validatePayoutOrder } = require("../src/domain/cycles.cjs");

test("three active members are too few to start a cycle", () => {
  const members = ["1", "2", "3"];
  const payoutOrder = ["2", "3", "1"];

  const error = validatePayoutOrder(members, payoutOrder);

  assert.equal(error, "A cycle needs between 4 and 20 active members.");
});

test("four active members can each take one payout position", () => {
  const members = ["1", "2", "3", "4"];
  const payoutOrder = ["2", "4", "1", "3"];

  const error = validatePayoutOrder(members, payoutOrder);

  assert.ok(!error, `Expected a valid payout order, but got: ${error}`);
});
function makeMemberIds(count) {
  return Array.from({ length: count }, (_, index) => String(index + 1));
}

test("20 active members can start a cycle", () => {
  const members = makeMemberIds(20);
  assert.ok(!validatePayoutOrder(members, members));
});

test("21 active members are too many", () => {
  const members = makeMemberIds(21);
  const error = validatePayoutOrder(members, members);
  assert.equal(error, "A cycle needs between 4 and 20 active members.");
});

test("a member cannot take two payout positions", () => {
  const members = ["1", "2", "3", "4"];
  const error = validatePayoutOrder(members, ["1", "2", "3", "3"]);
  assert.ok(error, "Expected a repeated member to be rejected");
});

test("every member must have a payout position", () => {
  const members = ["1", "2", "3", "4"];
  const error = validatePayoutOrder(members, ["1", "2", "3"]);
  assert.ok(error, "Expected an incomplete payout order to be rejected");
});

test("someone outside the circle cannot take a payout position", () => {
  const members = ["1", "2", "3", "4"];
  const error = validatePayoutOrder(members, ["1", "2", "3", "99"]);
  assert.ok(error, "Expected an outsider to be rejected");
});