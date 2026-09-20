const test = require("node:test");
const assert = require("node:assert/strict");

const { requireOwnerToken } = require("../dist/backend/engine/helpers/reducer/validation/requireOwnerToken.js");

const buildGame = (overrides = {}) => ({
  id: "game-1",
  ownerToken: "owner-token",
  ...overrides,
});

test("requireOwnerToken does not throw when the token matches the owner", () => {
  assert.doesNotThrow(() => requireOwnerToken(buildGame(), "owner-token"));
});

test("requireOwnerToken throws when the token does not match the owner", () => {
  assert.throws(() => requireOwnerToken(buildGame(), "not-the-owner"), /owner token required/i);
});

test("requireOwnerToken throws when the game is undefined", () => {
  assert.throws(() => requireOwnerToken(undefined, "owner-token"), /game not found/i);
});
