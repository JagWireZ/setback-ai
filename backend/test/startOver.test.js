const test = require("node:test");
const assert = require("node:assert/strict");

const { startOver } = require("../dist/backend/engine/reducer/startOver.js");

const createGame = (phaseStage = "Playing") => ({
  id: "game-1",
  version: 3,
  ownerToken: "owner-token",
  options: {
    maxCards: 5,
    blindBid: false,
    rounds: [{ cardCount: 5, direction: "up" }],
  },
  players: [
    { id: "p1", name: "Player 1", type: "human", connected: true },
    { id: "p2", name: "Player 2", type: "human", connected: true },
  ],
  playerTokens: [
    { playerId: "p1", token: "token-1" },
    { playerId: "p2", token: "token-2" },
  ],
  playerOrder: ["p1", "p2"],
  scores: [
    {
      playerId: "p1",
      total: 10,
      possible: 10,
      rounds: [{ total: 10, possible: 10, rainbow: true, bid: 5, books: 5 }],
    },
    {
      playerId: "p2",
      total: -5,
      possible: 10,
      rounds: [{ total: -5, possible: 10, rainbow: false, bid: 2, books: 1 }],
    },
  ],
  phase:
    phaseStage === "Lobby"
      ? { stage: "Lobby" }
      : {
          stage: phaseStage,
          dealerPlayerId: "p1",
          roundIndex: 0,
          trickIndex: 0,
          turnPlayerId: "p1",
          bids: [],
          cards: {
            deck: [],
            trump: { rank: "A", suit: "Spades" },
            trumpBroken: false,
            hands: [],
            currentTrick: { index: 0, leadPlayerId: "p1", plays: [] },
            completedTricks: [],
          },
        },
});

test("startOver resets an in-progress game back to lobby and clears scores", () => {
  const updated = startOver(createGame("Playing"), {
    action: "startOver",
    payload: {
      gameId: "game-1",
      playerToken: "token-1",
    },
  });

  assert.equal(updated.phase.stage, "Lobby");
  assert.deepEqual(
    updated.scores.map((score) => ({
      playerId: score.playerId,
      total: score.total,
      rounds: score.rounds.length,
    })),
    [
      { playerId: "p1", total: 0, rounds: 0 },
      { playerId: "p2", total: 0, rounds: 0 },
    ],
  );
});

test("startOver also allows resetting a game that is already in the lobby", () => {
  const updated = startOver(createGame("Lobby"), {
    action: "startOver",
    payload: {
      gameId: "game-1",
      playerToken: "token-1",
    },
  });

  assert.equal(updated.phase.stage, "Lobby");
  assert.deepEqual(
    updated.scores.map((score) => ({
      playerId: score.playerId,
      total: score.total,
      rounds: score.rounds.length,
    })),
    [
      { playerId: "p1", total: 0, rounds: 0 },
      { playerId: "p2", total: 0, rounds: 0 },
    ],
  );
});
