const test = require("node:test");
const assert = require("node:assert/strict");

const { generateGameId } = require("../dist/backend/engine/helpers/generateGameId.js");

test("generateGameId returns '<adjective>-<animal>'", () => {
  const gameId = generateGameId();

  assert.match(gameId, /^[a-z]+-[a-z]+$/);
  const [adjective, animal] = gameId.split("-");
  assert.ok(adjective.length > 0);
  assert.ok(animal.length > 0);
});

test("generateGameId consistently returns valid format", () => {
  for (let i = 0; i < 500; i += 1) {
    const gameId = generateGameId();
    assert.match(gameId, /^[a-z]+-[a-z]+$/);
  }
});
