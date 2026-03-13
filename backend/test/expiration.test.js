const test = require("node:test");
const assert = require("node:assert/strict");

const {
  GAME_TTL_SECONDS,
  buildExpiresAt,
  isExpired,
} = require("../dist/backend/engine/helpers/reducer/storage/expiration.js");

test("buildExpiresAt sets expiration 3 days in the future", () => {
  const nowMs = Date.UTC(2026, 2, 13, 12, 0, 0);
  const expiresAt = buildExpiresAt(nowMs);

  assert.equal(expiresAt, Math.floor(nowMs / 1000) + GAME_TTL_SECONDS);
});

test("isExpired returns true only when expiration time has passed", () => {
  const nowMs = Date.UTC(2026, 2, 13, 12, 0, 0);
  const nowSeconds = Math.floor(nowMs / 1000);

  assert.equal(isExpired(nowSeconds - 1, nowMs), true);
  assert.equal(isExpired(nowSeconds, nowMs), true);
  assert.equal(isExpired(nowSeconds + 1, nowMs), false);
});
