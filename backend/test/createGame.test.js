const test = require("node:test");
const assert = require("node:assert/strict");

const { createGame } = require("../dist/backend/engine/reducer/createGame.js");

test("createGame builds a lobby game with one host and four AI players", () => {
  const { game, playerToken } = createGame({
    action: "createGame",
    payload: {
      playerName: "Casey",
    },
  });

  assert.equal(game.version, 1);
  assert.equal(game.phase.stage, "Lobby");
  assert.equal(game.players.length, 5);
  assert.equal(game.players[0].name, "Casey");
  assert.equal(game.players[0].type, "human");
  assert.equal(game.players.slice(1).every((player) => player.type === "ai"), true);
  assert.deepEqual(game.playerOrder, game.players.map((player) => player.id));
  assert.equal(game.scores.length, 5);
  assert.equal(game.playerTokens.length, 5);
  assert.equal(game.ownerToken, playerToken);
  assert.equal(game.playerTokens[0].token, playerToken);
  assert.equal(game.options.blindBid, false);
  assert.equal(game.options.maxCards, 10);
  assert.equal(game.options.aiDifficulty, "medium");
  assert.deepEqual(game.reactions, []);
});

test("createGame respects an explicit blindBid flag", () => {
  const { game } = createGame({
    action: "createGame",
    payload: {
      playerName: "Casey",
      blindBid: true,
    },
  });

  assert.equal(game.options.blindBid, true);
});

test("createGame assigns unique bot names to the AI seats", () => {
  const { game } = createGame({
    action: "createGame",
    payload: {
      playerName: "Casey",
    },
  });

  const aiNames = game.players.filter((player) => player.type === "ai").map((player) => player.name);
  assert.equal(new Set(aiNames).size, aiNames.length);
});
