const test = require("node:test");
const assert = require("node:assert/strict");

const { checkState } = require("../dist/backend/engine/reducer/checkState.js");

const createPlayingGame = () => ({
  id: "game-1",
  version: 1,
  ownerToken: "owner-token",
  options: {
    maxCards: 5,
    blindBid: false,
    aiDifficulty: "medium",
    rounds: [{ cardCount: 1, direction: "up" }],
  },
  players: [
    { id: "p1", name: "Owner", type: "human", connected: true },
    { id: "p2", name: "Bot A", type: "ai", connected: true },
    { id: "p3", name: "Bot B", type: "ai", connected: true },
  ],
  playerTokens: [
    { playerId: "p1", token: "owner-token" },
    { playerId: "p2", token: "token-2" },
    { playerId: "p3", token: "token-3" },
  ],
  playerOrder: ["p1", "p2", "p3"],
  scores: [
    { playerId: "p1", total: 0, possible: 0, rounds: [] },
    { playerId: "p2", total: 0, possible: 0, rounds: [] },
    { playerId: "p3", total: 0, possible: 0, rounds: [] },
  ],
  reactions: [],
  phase: {
    stage: "Playing",
    dealerPlayerId: "p1",
    roundIndex: 0,
    trickIndex: 0,
    turnPlayerId: "p2",
    turnStartedAt: Date.now() - 10_000,
    turnDueAt: Date.now() - 5_000,
    bids: [
      { playerId: "p1", amount: 0, trip: false },
      { playerId: "p2", amount: 1, trip: false },
      { playerId: "p3", amount: 0, trip: false },
    ],
    cards: {
      deck: [],
      trump: { rank: "A", suit: "Spades" },
      trumpBroken: true,
      hands: [
        { playerId: "p1", cards: [{ rank: "2", suit: "Clubs" }] },
        { playerId: "p2", cards: [{ rank: "K", suit: "Clubs" }] },
        { playerId: "p3", cards: [{ rank: "Q", suit: "Clubs" }] },
      ],
      currentTrick: {
        index: 0,
        leadPlayerId: "p1",
        plays: [{ playerId: "p1", card: { rank: "2", suit: "Clubs" } }],
      },
      completedTricks: [],
    },
  },
});

test("checkState advances only one due AI step", () => {
  const updated = checkState(createPlayingGame(), {
    action: "checkState",
    payload: {
      gameId: "game-1",
      playerToken: "owner-token",
    },
  });

  assert.equal(updated.version, 2);
  assert.equal(updated.phase.stage, "Playing");
  assert.equal(updated.phase.turnPlayerId, "p3");
  assert.equal(updated.phase.cards.currentTrick.plays.length, 2);
  assert.deepEqual(updated.phase.cards.currentTrick.plays[1], {
    playerId: "p2",
    card: { rank: "K", suit: "Clubs" },
  });
});
