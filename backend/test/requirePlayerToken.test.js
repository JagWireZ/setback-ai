const test = require("node:test");
const assert = require("node:assert/strict");

const { requirePlayerToken } = require("../dist/backend/engine/helpers/reducer/validation/requirePlayerToken.js");

const buildGame = (overrides = {}) => ({
  id: "game-1",
  playerTokens: [
    { playerId: "p1", token: "token-1" },
    { playerId: "p2", token: "token-2" },
  ],
  ...overrides,
});

test("requirePlayerToken does not throw for a known player token", () => {
  assert.doesNotThrow(() => requirePlayerToken(buildGame(), "token-1"));
});

test("requirePlayerToken throws for an unknown player token", () => {
  assert.throws(() => requirePlayerToken(buildGame(), "unknown-token"), /invalid player token/i);
});

test("requirePlayerToken throws when the game is undefined", () => {
  assert.throws(() => requirePlayerToken(undefined, "token-1"), /game not found/i);
});
