const test = require("node:test");
const assert = require("node:assert/strict");

const { buildPlayer } = require("../dist/backend/engine/helpers/reducer/player/buildPlayer.js");

test("buildPlayer creates a human player with the given name", () => {
  const player = buildPlayer("Alice");

  assert.equal(player.name, "Alice");
  assert.equal(player.type, "human");
  assert.equal(player.controller, "human");
  assert.equal(typeof player.id, "string");
  assert.ok(player.id.length > 0);
});

test("buildPlayer marks the player as connected and not away", () => {
  const before = Date.now();
  const player = buildPlayer("Bob");
  const after = Date.now();

  assert.equal(player.presence.connected, true);
  assert.equal(player.presence.away, false);
  assert.ok(player.presence.lastSeenAt >= before);
  assert.ok(player.presence.lastSeenAt <= after);
});

test("buildPlayer generates unique ids across calls", () => {
  const playerA = buildPlayer("Alice");
  const playerB = buildPlayer("Alice");

  assert.notEqual(playerA.id, playerB.id);
});
