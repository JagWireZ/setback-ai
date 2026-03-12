const test = require("node:test");
const assert = require("node:assert/strict");

const { renamePlayer } = require("../dist/backend/engine/reducer/renamePlayer.js");

const createGame = () => ({
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
    { id: "p2", name: "Robin", type: "human", connected: true },
  ],
  playerTokens: [
    { playerId: "p1", token: "token-1" },
    { playerId: "p2", token: "token-2" },
  ],
  playerOrder: ["p1", "p2"],
  scores: [],
  phase: { stage: "Lobby" },
});

test("renamePlayer updates only the authenticated player's name", () => {
  const updated = renamePlayer(createGame(), {
    action: "renamePlayer",
    payload: {
      gameId: "game-1",
      playerToken: "token-2",
      playerName: "Taylor",
    },
  });

  assert.equal(updated.players.find((player) => player.id === "p2").name, "Taylor");
  assert.equal(updated.players.find((player) => player.id === "p1").name, "Casey");
});

test("renamePlayer rejects blank names", () => {
  assert.throws(
    () =>
      renamePlayer(createGame(), {
        action: "renamePlayer",
        payload: {
          gameId: "game-1",
          playerToken: "token-1",
          playerName: "   ",
        },
      }),
    /player name is required/i,
  );
});
