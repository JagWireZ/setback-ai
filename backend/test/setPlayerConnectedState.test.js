const test = require("node:test");
const assert = require("node:assert/strict");

const { setPlayerConnectedState } = require("../dist/backend/engine/helpers/reducer/player/setPlayerConnectedState.js");

const baseGame = (players) => ({
  id: "game-1",
  version: 1,
  players,
});

test("setPlayerConnectedState sets connected to true", () => {
  const game = baseGame([{ id: "p1", presence: { connected: false, lastSeenAt: 1, away: true } }]);

  const result = setPlayerConnectedState(game, "p1", true);

  assert.equal(result.players[0].presence.connected, true);
  assert.equal(result.version, 2);
});

test("setPlayerConnectedState sets connected to false", () => {
  const game = baseGame([{ id: "p1", presence: { connected: true, lastSeenAt: 1, away: false } }]);

  const result = setPlayerConnectedState(game, "p1", false);

  assert.equal(result.players[0].presence.connected, false);
});

test("setPlayerConnectedState does not modify lastSeenAt or away", () => {
  const game = baseGame([{ id: "p1", presence: { connected: false, lastSeenAt: 123, away: true } }]);

  const result = setPlayerConnectedState(game, "p1", true);

  assert.equal(result.players[0].presence.lastSeenAt, 123);
  assert.equal(result.players[0].presence.away, true);
});

test("setPlayerConnectedState is a no-op when the connected value is unchanged", () => {
  const game = baseGame([{ id: "p1", presence: { connected: true, lastSeenAt: 1, away: false } }]);

  const result = setPlayerConnectedState(game, "p1", true);

  assert.equal(result, game);
});

test("setPlayerConnectedState is a no-op for an unknown playerId", () => {
  const game = baseGame([{ id: "p1" }]);

  const result = setPlayerConnectedState(game, "missing", true);

  assert.equal(result, game);
});
