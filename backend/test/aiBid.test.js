const test = require("node:test");
const assert = require("node:assert/strict");

const { reviewGameState } = require("../dist/backend/engine/ai/reviewGameState.js");

const createBiddingGame = ({ roundCardCount, handCards, trumpSuit, aiDifficulty = "medium" }) => ({
  id: "game-1",
  version: 1,
  ownerToken: "owner-token",
  options: {
    maxCards: 10,
    blindBid: false,
    aiDifficulty,
    rounds: [{ cardCount: roundCardCount, direction: "down" }],
  },
  players: [
    { id: "p1", name: "Bot Alpha", type: "ai", connected: true },
    { id: "p2", name: "Robin", type: "human", connected: true },
    { id: "p3", name: "Casey", type: "human", connected: true },
    { id: "p4", name: "Jordan", type: "human", connected: true },
  ],
  playerTokens: [
    { playerId: "p1", token: "ai-token" },
    { playerId: "p2", token: "token-2" },
    { playerId: "p3", token: "token-3" },
    { playerId: "p4", token: "token-4" },
  ],
  playerOrder: ["p4", "p1", "p2", "p3"],
  scores: [
    { playerId: "p1", total: 0, possible: 0, rounds: [] },
    { playerId: "p2", total: 0, possible: 0, rounds: [] },
    { playerId: "p3", total: 0, possible: 0, rounds: [] },
    { playerId: "p4", total: 0, possible: 0, rounds: [] },
  ],
  reactions: [],
  phase: {
    stage: "Bidding",
    dealerPlayerId: "p4",
    turnPlayerId: "p1",
    roundIndex: 0,
    trickIndex: 0,
    bids: [],
    cards: {
      deck: [],
      trump: { rank: "2", suit: trumpSuit },
      trumpBroken: false,
      hands: [
        { playerId: "p1", cards: handCards },
        { playerId: "p2", cards: [] },
        { playerId: "p3", cards: [] },
        { playerId: "p4", cards: [] },
      ],
      completedTricks: [],
    },
  },
});

test("AI bids zero with no trump cards and no royal cards", () => {
  const updated = reviewGameState(
    createBiddingGame({
      roundCardCount: 8,
      trumpSuit: "Hearts",
      handCards: [
        { rank: "2", suit: "Clubs" },
        { rank: "3", suit: "Diamonds" },
        { rank: "4", suit: "Spades" },
        { rank: "5", suit: "Clubs" },
        { rank: "6", suit: "Diamonds" },
        { rank: "7", suit: "Spades" },
        { rank: "8", suit: "Clubs" },
        { rank: "9", suit: "Diamonds" },
      ],
    }),
  );

  assert.equal(updated.phase.stage, "Bidding");
  assert.equal(updated.phase.bids.length, 1);
  assert.deepEqual(updated.phase.bids[0], {
    playerId: "p1",
    amount: 0,
    trip: false,
  });
});

test("AI trips a one-card round with ace of trump", () => {
  const originalRandom = Math.random;
  Math.random = () => 0.25;

  try {
    const updated = reviewGameState(
      createBiddingGame({
        roundCardCount: 1,
        trumpSuit: "Spades",
        aiDifficulty: "hard",
        handCards: [{ rank: "A", suit: "Spades" }],
      }),
    );

    assert.equal(updated.phase.bids.length, 1);
    assert.deepEqual(updated.phase.bids[0], {
      playerId: "p1",
      amount: 1,
      trip: true,
    });
  } finally {
    Math.random = originalRandom;
  }
});

test("reviewGameState submits consecutive AI bids until a human turn is reached", () => {
  const updated = reviewGameState({
    id: "game-1",
    version: 1,
    ownerToken: "owner-token",
    options: {
      maxCards: 4,
      blindBid: false,
      aiDifficulty: "medium",
      rounds: [{ cardCount: 4, direction: "down" }],
    },
    players: [
      { id: "p1", name: "Bot Alpha", type: "ai", connected: true },
      { id: "p2", name: "Bot Beta", type: "ai", connected: true },
      { id: "p3", name: "Robin", type: "human", connected: true },
      { id: "p4", name: "Jordan", type: "human", connected: true },
    ],
    playerTokens: [
      { playerId: "p1", token: "token-1" },
      { playerId: "p2", token: "token-2" },
      { playerId: "p3", token: "token-3" },
      { playerId: "p4", token: "token-4" },
    ],
    playerOrder: ["p4", "p1", "p2", "p3"],
    scores: [
      { playerId: "p1", total: 0, possible: 0, rounds: [] },
      { playerId: "p2", total: 0, possible: 0, rounds: [] },
      { playerId: "p3", total: 0, possible: 0, rounds: [] },
      { playerId: "p4", total: 0, possible: 0, rounds: [] },
    ],
    reactions: [],
    phase: {
      stage: "Bidding",
      dealerPlayerId: "p4",
      turnPlayerId: "p1",
      roundIndex: 0,
      trickIndex: 0,
      bids: [],
      cards: {
        deck: [],
        trump: { rank: "2", suit: "Hearts" },
        trumpBroken: false,
        hands: [
          {
            playerId: "p1",
            cards: [
              { rank: "2", suit: "Clubs" },
              { rank: "3", suit: "Diamonds" },
              { rank: "4", suit: "Spades" },
              { rank: "5", suit: "Clubs" },
            ],
          },
          {
            playerId: "p2",
            cards: [
              { rank: "6", suit: "Clubs" },
              { rank: "7", suit: "Diamonds" },
              { rank: "8", suit: "Spades" },
              { rank: "9", suit: "Clubs" },
            ],
          },
          { playerId: "p3", cards: [] },
          { playerId: "p4", cards: [] },
        ],
        completedTricks: [],
      },
    },
  });

  assert.equal(updated.phase.stage, "Bidding");
  assert.equal(updated.phase.turnPlayerId, "p3");
  assert.equal(updated.phase.bids.length, 2);
  assert.deepEqual(updated.phase.bids.map((bid) => bid.playerId), ["p1", "p2"]);
});
