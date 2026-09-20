const test = require("node:test");
const assert = require("node:assert/strict");

const { buildPlayerToken } = require("../dist/backend/engine/helpers/reducer/player/buildPlayerToken.js");

test("buildPlayerToken pairs the given playerId with a generated token", () => {
  const playerToken = buildPlayerToken("p1");

  assert.equal(playerToken.playerId, "p1");
  assert.equal(typeof playerToken.token, "string");
  assert.ok(playerToken.token.length > 0);
});

test("buildPlayerToken generates unique tokens across calls", () => {
  const tokenA = buildPlayerToken("p1");
  const tokenB = buildPlayerToken("p1");

  assert.notEqual(tokenA.token, tokenB.token);
});
