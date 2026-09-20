const test = require("node:test");
const assert = require("node:assert/strict");

const {
  requireGameForAction,
  requirePlayerTokenEntry,
  requirePlayerActionContext,
} = require("../dist/backend/engine/helpers/reducer/validation/actionContext.js");

const buildGame = (overrides = {}) => ({
  id: "game-1",
  playerTokens: [
    { playerId: "p1", token: "token-1" },
    { playerId: "p2", token: "token-2" },
  ],
  ...overrides,
});

test("requireGameForAction returns the game when the event's gameId matches", () => {
  const game = buildGame();

  const result = requireGameForAction(game, { payload: { gameId: "game-1" } });

  assert.equal(result, game);
});

test("requireGameForAction throws when the game is undefined", () => {
  assert.throws(
    () => requireGameForAction(undefined, { payload: { gameId: "game-1" } }),
    /game not found/i,
  );
});

test("requireGameForAction throws when the event's gameId does not match the game", () => {
  assert.throws(
    () => requireGameForAction(buildGame(), { payload: { gameId: "other-game" } }),
    /game id mismatch/i,
  );
});

test("requirePlayerTokenEntry returns the matching player token entry", () => {
  const game = buildGame();

  const entry = requirePlayerTokenEntry(game, "token-2");

  assert.deepEqual(entry, { playerId: "p2", token: "token-2" });
});

test("requirePlayerTokenEntry throws when no entry matches the token", () => {
  assert.throws(
    () => requirePlayerTokenEntry(buildGame(), "unknown-token"),
    /invalid player token/i,
  );
});

test("requirePlayerActionContext returns the game, playerId, and token entry", () => {
  const game = buildGame();

  const context = requirePlayerActionContext(game, {
    payload: { gameId: "game-1", playerToken: "token-1" },
  });

  assert.equal(context.game, game);
  assert.equal(context.playerId, "p1");
  assert.deepEqual(context.playerTokenEntry, { playerId: "p1", token: "token-1" });
});

test("requirePlayerActionContext throws when the game is undefined", () => {
  assert.throws(
    () =>
      requirePlayerActionContext(undefined, {
        payload: { gameId: "game-1", playerToken: "token-1" },
      }),
    /game not found/i,
  );
});

test("requirePlayerActionContext throws when the gameId does not match", () => {
  assert.throws(
    () =>
      requirePlayerActionContext(buildGame(), {
        payload: { gameId: "other-game", playerToken: "token-1" },
      }),
    /game id mismatch/i,
  );
});

test("requirePlayerActionContext throws when the player token is invalid", () => {
  assert.throws(
    () =>
      requirePlayerActionContext(buildGame(), {
        payload: { gameId: "game-1", playerToken: "unknown-token" },
      }),
    /invalid player token/i,
  );
});
