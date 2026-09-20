const test = require("node:test");
const assert = require("node:assert/strict");

const { requireGame } = require("../dist/backend/engine/helpers/reducer/validation/requireGame.js");

test("requireGame returns the game when it is defined", () => {
  const game = { id: "game-1" };

  assert.equal(requireGame(game), game);
});

test("requireGame throws when the game is undefined", () => {
  assert.throws(() => requireGame(undefined), /game not found/i);
});
