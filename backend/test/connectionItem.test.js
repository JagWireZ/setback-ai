const test = require("node:test");
const assert = require("node:assert/strict");

const {
  connectionItemId,
  connectionEntityType,
  toConnectionItem,
} = require("../dist/backend/engine/helpers/reducer/storage/connectionItem.js");

test("connectionItemId prefixes the connection id", () => {
  assert.equal(connectionItemId("conn-1"), "connection#conn-1");
});

test("connectionEntityType prefixes the connection id the same way as connectionItemId", () => {
  assert.equal(connectionEntityType("conn-1"), "connection#conn-1");
  assert.equal(connectionEntityType("conn-1"), connectionItemId("conn-1"));
});

test("toConnectionItem builds a connection item with expiration", () => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const item = toConnectionItem("conn-1", "game-1", "token-1");

  assert.equal(item.id, "connection#conn-1");
  assert.equal(item.gameId, "game-1");
  assert.equal(item.entityType, "connection#conn-1");
  assert.equal(item.connectionId, "conn-1");
  assert.equal(item.playerToken, "token-1");
  assert.equal(typeof item.expiresAt, "number");
  assert.ok(item.expiresAt > nowSeconds);
});
