const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeGameId } = require("../dist/backend/engine/helpers/reducer/gameId/normalizeGameId.js");

test("normalizeGameId lowercases and trims mixed-case IDs", () => {
  assert.equal(normalizeGameId("  Keen-Ram  "), "keen-ram");
});
