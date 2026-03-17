const test = require("node:test");
const assert = require("node:assert/strict");

const {
  shouldRunAiAfterCompletedTrick,
} = require("../dist/backend/src/shouldRunAiAfterCompletedTrick.js");

const createPlayingGame = (turnPlayerType) => ({
  id: "game-1",
  version: 1,
  ownerToken: "owner-token",
  options: {
    maxCards: 5,
    blindBid: false,
    rounds: [{ cardCount: 5, direction: "up" }],
  },
  players: [
    { id: "p1", name: "Bot", type: turnPlayerType, connected: true },
    { id: "p2", name: "Robin", type: "human", connected: true },
  ],
  playerTokens: [
    { playerId: "p1", token: "token-1" },
    { playerId: "p2", token: "token-2" },
  ],
  playerOrder: ["p1", "p2"],
  scores: [
    { playerId: "p1", total: 0, possible: 0, rounds: [] },
    { playerId: "p2", total: 0, possible: 0, rounds: [] },
  ],
  reactions: [],
  phase: {
    stage: "Playing",
    dealerPlayerId: "p2",
    roundIndex: 0,
    trickIndex: 1,
    turnPlayerId: "p1",
    bids: [],
    cards: {
      deck: [],
      trump: { rank: "A", suit: "Spades" },
      trumpBroken: true,
      hands: [
        { playerId: "p1", cards: [{ rank: "2", suit: "Clubs" }] },
        { playerId: "p2", cards: [{ rank: "3", suit: "Clubs" }] },
      ],
      currentTrick: undefined,
      completedTricks: [],
    },
  },
});

test("returns true when a completed trick hands the turn to an AI player", () => {
  assert.equal(shouldRunAiAfterCompletedTrick(createPlayingGame("ai")), true);
});

test("returns false when a completed trick hands the turn to a human player", () => {
  assert.equal(shouldRunAiAfterCompletedTrick(createPlayingGame("human")), false);
});

test("returns false outside the playing phase", () => {
  const game = createPlayingGame("ai");
  game.phase = { stage: "GameOver" };

  assert.equal(shouldRunAiAfterCompletedTrick(game), false);
});
