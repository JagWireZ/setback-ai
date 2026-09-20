const test = require("node:test");
const assert = require("node:assert/strict");

const { buildScore } = require("../dist/backend/engine/helpers/reducer/player/buildScore.js");

test("buildScore initializes a zeroed score for the given player", () => {
  const score = buildScore("p1");

  assert.deepEqual(score, {
    playerId: "p1",
    total: 0,
    possible: 0,
    rounds: [],
  });
});

test("buildScore returns a fresh rounds array each call", () => {
  const scoreA = buildScore("p1");
  const scoreB = buildScore("p1");

  assert.notEqual(scoreA.rounds, scoreB.rounds);
});
