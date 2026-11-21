const test = require("node:test");
const assert = require("node:assert/strict");
const { validatePayoutOrder } = require("./cycles.cjs");

test("Alex and Sam alone cannot start a cycle", () => {
  assert.equal(
    validatePayoutOrder(["1", "2"], ["1", "2"]),
    "A cycle needs between 4 and 20 active members."
  );
});

test("four members can receive the pot in the admin's chosen order", () => {
  assert.equal(
    validatePayoutOrder(["1", "2", "3", "4"], ["3", "1", "4", "2"]),
    null
  );
});

test("a four-person cycle cannot leave one member out", () => {
  assert.equal(
    validatePayoutOrder(["1", "2", "3", "4"], ["1", "2", "3"]),
    "Give every active member one payout position."
  );
});

test("one member cannot take two payout turns", () => {
  assert.equal(
    validatePayoutOrder(["1", "2", "3", "4"], ["1", "2", "3", "3"]),
    "The payout order must include each active member exactly once."
  );
});

test("someone outside the circle cannot take a member's turn", () => {
  assert.equal(
    validatePayoutOrder(["1", "2", "3", "4"], ["1", "2", "3", "9"]),
    "The payout order must include each active member exactly once."
  );
});

test("twenty members can start a cycle and twenty-one cannot", () => {
  const twenty = Array.from({ length: 20 }, (_, index) => String(index + 1));
  assert.equal(validatePayoutOrder(twenty, twenty), null);

  const twentyOne = [...twenty, "21"];
  assert.equal(
    validatePayoutOrder(twentyOne, twentyOne),
    "A cycle needs between 4 and 20 active members."
  );
});