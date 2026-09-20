const test = require("node:test");
const assert = require("node:assert/strict");

const { buildAiPlayer } = require("../dist/backend/engine/helpers/reducer/player/buildAiPlayer.js");

test("buildAiPlayer creates a player with type 'ai'", () => {
  const player = buildAiPlayer("Bot 1");

  assert.equal(player.name, "Bot 1");
  assert.equal(player.type, "ai");
});

test("buildAiPlayer still has the standard buildPlayer fields", () => {
  const player = buildAiPlayer("Bot 2");

  assert.equal(player.controller, "human");
  assert.equal(player.presence.connected, true);
  assert.equal(player.presence.away, false);
  assert.equal(typeof player.id, "string");
});

test("buildAiPlayer generates unique ids across calls", () => {
  const playerA = buildAiPlayer("Bot 1");
  const playerB = buildAiPlayer("Bot 1");

  assert.notEqual(playerA.id, playerB.id);
});
