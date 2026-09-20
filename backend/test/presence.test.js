const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getPlayerPresence,
  getPlayerController,
  mapPlayerState,
  setPlayerPresence,
  touchPlayerPresence,
  setPlayerController,
} = require("../dist/backend/engine/helpers/reducer/player/presence.js");

const baseGame = (players) => ({
  id: "game-1",
  version: 1,
  players,
});

test("getPlayerPresence prefers the structured presence field when present", () => {
  const player = {
    id: "p1",
    presence: { connected: true, lastSeenAt: 100, away: false },
    connected: false,
    lastActiveAt: 50,
  };

  assert.deepEqual(getPlayerPresence(player), { connected: true, lastSeenAt: 100, away: false });
});

test("getPlayerPresence falls back to legacy connected/lastActiveAt fields", () => {
  const player = { id: "p1", connected: true, lastActiveAt: 42 };

  assert.deepEqual(getPlayerPresence(player), { connected: true, lastSeenAt: 42, away: false });
});

test("getPlayerPresence defaults connected to false and away true when legacy connected is false", () => {
  const player = { id: "p1", connected: false };

  assert.deepEqual(getPlayerPresence(player), { connected: false, lastSeenAt: undefined, away: true });
});

test("getPlayerPresence defaults to disconnected/not-away when nothing is set", () => {
  const player = { id: "p1" };

  assert.deepEqual(getPlayerPresence(player), { connected: false, lastSeenAt: undefined, away: false });
});

test("getPlayerController defaults to 'human'", () => {
  assert.equal(getPlayerController({ id: "p1" }), "human");
});

test("getPlayerController returns the explicit controller", () => {
  assert.equal(getPlayerController({ id: "p1", controller: "ai-temporary" }), "ai-temporary");
});

test("mapPlayerState returns the same game reference when the mapper does not change the target player", () => {
  const game = baseGame([{ id: "p1", name: "A" }, { id: "p2", name: "B" }]);

  const result = mapPlayerState(game, "p1", (player) => player);

  assert.equal(result, game);
});

test("mapPlayerState returns a new game with only the targeted player replaced", () => {
  const game = baseGame([{ id: "p1", name: "A" }, { id: "p2", name: "B" }]);

  const result = mapPlayerState(game, "p1", (player) => ({ ...player, name: "Changed" }));

  assert.notEqual(result, game);
  assert.equal(result.players[0].name, "Changed");
  assert.equal(result.players[1], game.players[1]);
});

test("mapPlayerState leaves the game untouched when playerId does not match any player", () => {
  const game = baseGame([{ id: "p1", name: "A" }]);

  const result = mapPlayerState(game, "missing", (player) => ({ ...player, name: "Changed" }));

  assert.equal(result, game);
});

test("setPlayerPresence merges the patch into the current presence and bumps the version", () => {
  const game = baseGame([
    { id: "p1", presence: { connected: true, lastSeenAt: 1, away: false } },
  ]);

  const result = setPlayerPresence(game, "p1", { away: true });

  assert.equal(result.version, 2);
  assert.deepEqual(result.players[0].presence, { connected: true, lastSeenAt: 1, away: true });
});

test("setPlayerPresence returns the same game when the patch does not change anything", () => {
  const game = baseGame([
    { id: "p1", presence: { connected: true, lastSeenAt: 1, away: false } },
  ]);

  const result = setPlayerPresence(game, "p1", { connected: true });

  assert.equal(result, game);
  assert.equal(result.version, 1);
});

test("setPlayerPresence is a no-op for a playerId that does not exist", () => {
  const game = baseGame([{ id: "p1" }]);

  const result = setPlayerPresence(game, "missing", { connected: true });

  assert.equal(result, game);
});

test("touchPlayerPresence updates lastSeenAt to now by default", () => {
  const game = baseGame([{ id: "p1", presence: { connected: true, lastSeenAt: 1, away: false } }]);
  const before = Date.now();

  const result = touchPlayerPresence(game, "p1");
  const after = Date.now();

  assert.ok(result.players[0].presence.lastSeenAt >= before);
  assert.ok(result.players[0].presence.lastSeenAt <= after);
  assert.equal(result.players[0].presence.connected, true);
});

test("touchPlayerPresence uses the provided lastSeenAt and updates connected when given", () => {
  const game = baseGame([{ id: "p1", presence: { connected: false, lastSeenAt: 1, away: true } }]);

  const result = touchPlayerPresence(game, "p1", { connected: true, lastSeenAt: 500 });

  assert.deepEqual(result.players[0].presence, { connected: true, lastSeenAt: 500, away: true });
});

test("touchPlayerPresence omits the connected field when not provided in options", () => {
  const game = baseGame([{ id: "p1", presence: { connected: true, lastSeenAt: 1, away: false } }]);

  const result = touchPlayerPresence(game, "p1", { lastSeenAt: 500 });

  assert.equal(result.players[0].presence.connected, true);
  assert.equal(result.players[0].presence.lastSeenAt, 500);
});

test("setPlayerController sets a new controller value", () => {
  const game = baseGame([{ id: "p1", controller: "human" }]);

  const result = setPlayerController(game, "p1", "ai-temporary");

  assert.notEqual(result, game);
  assert.equal(result.players[0].controller, "ai-temporary");
});

test("setPlayerController is a no-op when the controller is unchanged", () => {
  const game = baseGame([{ id: "p1", controller: "ai-temporary" }]);

  const result = setPlayerController(game, "p1", "ai-temporary");

  assert.equal(result, game);
});

test("setPlayerController treats an unset controller as 'human' for comparison", () => {
  const game = baseGame([{ id: "p1" }]);

  const result = setPlayerController(game, "p1", "human");

  assert.equal(result, game);
});
