const test = require("node:test");
const assert = require("node:assert/strict");

const {
  gameVersionItemId,
  toGameVersionItem,
} = require("../dist/backend/engine/helpers/reducer/storage/gameVersionItem.js");

test("gameVersionItemId appends the version suffix to the game id", () => {
  assert.equal(gameVersionItemId("game-1"), "game-1#version");
});

test("toGameVersionItem builds a version item from the game", () => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const game = {
    id: "game-1",
    version: 3,
    playerTokens: [
      { playerId: "p1", token: "token-1" },
      { playerId: "p2", token: "token-2" },
    ],
  };

  const item = toGameVersionItem(game);

  assert.equal(item.id, "game-1#version");
  assert.equal(item.gameId, "game-1");
  assert.equal(item.entityType, "version");
  assert.equal(item.version, 3);
  assert.deepEqual(item.playerTokens, game.playerTokens);
  assert.equal(typeof item.expiresAt, "number");
  assert.ok(item.expiresAt > nowSeconds);
});
