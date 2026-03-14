const test = require("node:test");
const assert = require("node:assert/strict");

const { startGame } = require("../dist/backend/engine/reducer/startGame.js");

const createLobbyGame = () => ({
  id: "game-1",
  version: 1,
  ownerToken: "owner-token",
  options: {
    maxCards: 10,
    blindBid: false,
    aiDifficulty: "medium",
    rounds: [],
  },
  players: [
    { id: "p1", name: "Casey", type: "human", connected: true },
    { id: "p2", name: "Robin", type: "human", connected: true },
    { id: "p3", name: "Jordan", type: "human", connected: true },
  ],
  playerTokens: [
    { playerId: "p1", token: "owner-token" },
    { playerId: "p2", token: "token-2" },
    { playerId: "p3", token: "token-3" },
  ],
  playerOrder: ["p1", "p2", "p3"],
  scores: [],
  reactions: [],
  phase: { stage: "Lobby" },
});

test("startGame applies maxCards and generates rounds when leaving the lobby", () => {
  const updated = startGame(createLobbyGame(), {
    action: "startGame",
    payload: {
      gameId: "game-1",
      playerToken: "owner-token",
      maxCards: 5,
      dealerPlayerId: "p2",
      aiDifficulty: "hard",
    },
  });

  assert.equal(updated.options.maxCards, 5);
  assert.equal(updated.options.aiDifficulty, "hard");
  assert.deepEqual(
    updated.options.rounds.map((round) => `${round.cardCount}-${round.direction}`),
    ["5-down", "4-down", "3-down", "2-down", "1-down", "2-up", "3-up", "4-up", "5-up"],
  );
  assert.deepEqual(updated.playerOrder, ["p2", "p3", "p1"]);
  assert.equal(updated.phase.stage, "Dealing");
  assert.equal(updated.phase.dealerPlayerId, "p2");
});
