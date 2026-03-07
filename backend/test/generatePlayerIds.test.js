const test = require("node:test");
const assert = require("node:assert/strict");

const { generatePlayerId } = require("../dist/backend/engine/helpers/generatePlayerId.js");
const { generatePlayerToken } = require("../dist/backend/engine/helpers/generatePlayerToken.js");

test("generatePlayerId returns first 8 UUID characters", () => {
  const playerId = generatePlayerId();

  assert.equal(playerId.length, 8);
  assert.match(playerId, /^[0-9a-f]{8}$/);
});

test("generatePlayerId consistently returns valid 8-char ids", () => {
  for (let i = 0; i < 500; i += 1) {
    const playerId = generatePlayerId();
    assert.equal(playerId.length, 8);
    assert.match(playerId, /^[0-9a-f]{8}$/);
  }
});

test("generatePlayerToken returns full UUID", () => {
  const token = generatePlayerToken();

  assert.match(
    token,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});

test("generatePlayerToken consistently returns valid UUIDs", () => {
  for (let i = 0; i < 500; i += 1) {
    const token = generatePlayerToken();
    assert.match(
      token,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  }
});
