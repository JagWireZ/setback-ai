const test = require("node:test");
const assert = require("node:assert/strict");

const { getMaxCardsForSeatCount } = require("../dist/backend/engine/helpers/getMaxCardsForSeatCount.js");

test("getMaxCardsForSeatCount returns 10 when seats are few enough to support the max", () => {
  assert.equal(getMaxCardsForSeatCount(1), 10);
  assert.equal(getMaxCardsForSeatCount(2), 10);
});

test("getMaxCardsForSeatCount reduces max cards as seat count grows", () => {
  // floor((54 - 1) / seatCount), capped at 10
  assert.equal(getMaxCardsForSeatCount(5), 10);
  assert.equal(getMaxCardsForSeatCount(6), 8);
  assert.equal(getMaxCardsForSeatCount(8), 6);
  assert.equal(getMaxCardsForSeatCount(10), 5);
});

test("getMaxCardsForSeatCount throws for a non-positive seat count", () => {
  assert.throws(() => getMaxCardsForSeatCount(0), /positive integer/i);
  assert.throws(() => getMaxCardsForSeatCount(-3), /positive integer/i);
});

test("getMaxCardsForSeatCount throws for a non-integer seat count", () => {
  assert.throws(() => getMaxCardsForSeatCount(2.5), /positive integer/i);
});
