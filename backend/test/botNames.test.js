const test = require("node:test");
const assert = require("node:assert/strict");

const { createGame } = require("../dist/backend/engine/reducer/createGame.js");
const { removePlayer } = require("../dist/backend/engine/reducer/removePlayer.js");
const { BOT_NAMES } = require("../dist/backend/engine/helpers/reducer/player/getBotName.js");

test("createGame assigns bot names from the curated pool", () => {
  const result = createGame({
    action: "createGame",
    payload: {
      playerName: "Casey",
      maxCards: 5,
    },
  });

  const aiPlayers = result.game.players.filter((player) => player.type === "ai");

  assert.equal(aiPlayers.length, 4);
  assert.deepEqual(
    aiPlayers.map((player) => player.name),
    ["Sharp Shuffle", "Deadly Weapon", "Ace Machine", "Trick Snatcher"],
  );
  assert.ok(aiPlayers.every((player) => BOT_NAMES.includes(player.name)));
});

test("removePlayer replaces a human with an available curated bot name", () => {
  const removedPlayerToken = "token-3";
  const updated = removePlayer(
    {
      id: "game-1",
      version: 1,
      ownerToken: "owner-token",
      options: {
        maxCards: 5,
        blindBid: false,
        rounds: [{ cardCount: 5, direction: "up" }],
      },
      players: [
        { id: "p1", name: "Casey", type: "human", connected: true },
        { id: "p2", name: "Sharp Shuffle", type: "ai", connected: true },
        { id: "p3", name: "Robin", type: "human", connected: true },
      ],
      playerTokens: [
        { playerId: "p1", token: "owner-token" },
        { playerId: "p2", token: "token-2" },
        { playerId: "p3", token: removedPlayerToken },
      ],
      playerOrder: ["p1", "p2", "p3"],
      scores: [],
      reactions: [],
      phase: { stage: "Lobby" },
    },
    {
      action: "removePlayer",
      payload: {
        gameId: "game-1",
        playerId: "p3",
      },
    },
  );

  const replacement = updated.players.find((player) => player.id === "p3");

  assert.equal(replacement.type, "ai");
  assert.equal(replacement.connected, true);
  assert.equal(replacement.name, "Deadly Weapon");
  assert.ok(BOT_NAMES.includes(replacement.name));
  assert.notEqual(
    updated.playerTokens.find((playerToken) => playerToken.playerId === "p3").token,
    removedPlayerToken,
  );
});
