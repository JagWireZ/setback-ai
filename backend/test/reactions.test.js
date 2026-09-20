const test = require("node:test");
const assert = require("node:assert/strict");

const {
  REACTION_TTL_MS,
  pruneActiveReactions,
} = require("../dist/backend/engine/helpers/reducer/gameState/reactions.js");

test("pruneActiveReactions returns an empty array when given undefined", () => {
  assert.deepEqual(pruneActiveReactions(undefined), []);
});

test("pruneActiveReactions returns an empty array when given an empty array", () => {
  assert.deepEqual(pruneActiveReactions([], 1_000), []);
});

test("pruneActiveReactions filters out reactions older than the TTL", () => {
  const now = 100_000;
  const reactions = [
    { id: "1", playerId: "p1", createdAt: now - REACTION_TTL_MS - 1 },
    { id: "2", playerId: "p2", createdAt: now - REACTION_TTL_MS + 1 },
    { id: "3", playerId: "p3", createdAt: now },
  ];

  const pruned = pruneActiveReactions(reactions, now);

  assert.deepEqual(
    pruned.map((reaction) => reaction.id),
    ["2", "3"],
  );
});

test("pruneActiveReactions keeps only the most recent MAX_REACTIONS entries", () => {
  const now = 1_000_000;
  const reactions = Array.from({ length: 25 }, (_, index) => ({
    id: String(index),
    playerId: "p1",
    createdAt: now,
  }));

  const pruned = pruneActiveReactions(reactions, now);

  assert.equal(pruned.length, 20);
  assert.equal(pruned[0].id, "5");
  assert.equal(pruned[pruned.length - 1].id, "24");
});

test("pruneActiveReactions defaults `now` to Date.now() when omitted", () => {
  const reactions = [{ id: "1", playerId: "p1", createdAt: Date.now() }];

  const pruned = pruneActiveReactions(reactions);

  assert.deepEqual(
    pruned.map((reaction) => reaction.id),
    ["1"],
  );
});
