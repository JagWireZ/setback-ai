const test = require("node:test");
const assert = require("node:assert/strict");

const { touchPlayerActivity } = require("../dist/backend/engine/helpers/reducer/player/touchPlayerActivity.js");

const baseGame = (players) => ({
  id: "game-1",
  version: 1,
  players,
});

test("touchPlayerActivity updates lastSeenAt to the given nowMs", () => {
  const game = baseGame([{ id: "p1", presence: { connected: true, lastSeenAt: 1, away: false } }]);

  const result = touchPlayerActivity(game, "p1", { nowMs: 999 });

  assert.equal(result.players[0].presence.lastSeenAt, 999);
  assert.equal(result.players[0].presence.connected, true);
});

test("touchPlayerActivity defaults lastSeenAt to Date.now() when nowMs is omitted", () => {
  const game = baseGame([{ id: "p1", presence: { connected: true, lastSeenAt: 1, away: false } }]);
  const before = Date.now();

  const result = touchPlayerActivity(game, "p1");
  const after = Date.now();

  assert.ok(result.players[0].presence.lastSeenAt >= before);
  assert.ok(result.players[0].presence.lastSeenAt <= after);
});

test("touchPlayerActivity updates connected when provided", () => {
  const game = baseGame([{ id: "p1", presence: { connected: false, lastSeenAt: 1, away: true } }]);

  const result = touchPlayerActivity(game, "p1", { connected: true, nowMs: 500 });

  assert.equal(result.players[0].presence.connected, true);
  assert.equal(result.players[0].presence.lastSeenAt, 500);
});

test("touchPlayerActivity leaves connected untouched when not provided", () => {
  const game = baseGame([{ id: "p1", presence: { connected: true, lastSeenAt: 1, away: false } }]);

  const result = touchPlayerActivity(game, "p1", { nowMs: 500 });

  assert.equal(result.players[0].presence.connected, true);
});

test("touchPlayerActivity is a no-op for an unknown playerId", () => {
  const game = baseGame([{ id: "p1" }]);

  const result = touchPlayerActivity(game, "missing", { nowMs: 500 });

  assert.equal(result, game);
});
