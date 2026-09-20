const test = require("node:test");
const assert = require("node:assert/strict");

const { generateRounds } = require("../dist/backend/engine/helpers/generateRounds.js");

test("generateRounds counts down from maxCards to 1, then back up to maxCards", () => {
  const rounds = generateRounds(5);

  assert.deepEqual(
    rounds.map((round) => round.cardCount),
    [5, 4, 3, 2, 1, 2, 3, 4, 5],
  );
  assert.deepEqual(
    rounds.map((round) => round.direction),
    ["down", "down", "down", "down", "down", "up", "up", "up", "up"],
  );
});

test("generateRounds handles a maxCards of 1 with no ascending rounds", () => {
  const rounds = generateRounds(1);

  assert.deepEqual(rounds, [{ cardCount: 1, direction: "down" }]);
});

test("generateRounds handles a maxCards of 2", () => {
  const rounds = generateRounds(2);

  assert.deepEqual(rounds, [
    { cardCount: 2, direction: "down" },
    { cardCount: 1, direction: "down" },
    { cardCount: 2, direction: "up" },
  ]);
});

test("generateRounds scales with a larger maxCards", () => {
  const rounds = generateRounds(10);

  assert.equal(rounds.length, 19);
  assert.equal(rounds[0].cardCount, 10);
  assert.equal(rounds[9].cardCount, 1);
  assert.equal(rounds[18].cardCount, 10);
  assert.equal(rounds[9].direction, "down");
  assert.equal(rounds[10].direction, "up");
});
