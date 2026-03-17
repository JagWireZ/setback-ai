const test = require("node:test");
const assert = require("node:assert/strict");

const { reviewGameState } = require("../dist/backend/engine/ai/reviewGameState.js");

const createPlayingGame = ({
  hands,
  currentTrick,
  completedTricks = [],
  trumpSuit = "Spades",
  trumpBroken = true,
  bids,
  aiDifficulty = "hard",
}) => ({
  id: "game-1",
  version: 1,
  ownerToken: "owner-token",
  options: {
    maxCards: 5,
    blindBid: false,
    aiDifficulty,
    rounds: [{ cardCount: 5, direction: "up" }],
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
  playerOrder: ["p1", "p2", "p3", "p4"],
  scores: [
    { playerId: "p1", total: 0, possible: 0, rounds: [] },
    { playerId: "p2", total: 0, possible: 0, rounds: [] },
    { playerId: "p3", total: 0, possible: 0, rounds: [] },
    { playerId: "p4", total: 0, possible: 0, rounds: [] },
  ],
  reactions: [],
  phase: {
    stage: "Playing",
    dealerPlayerId: "p4",
    roundIndex: 0,
    trickIndex: completedTricks.length,
    turnPlayerId: "p1",
    bids,
    cards: {
      deck: [],
      trump: { rank: "2", suit: trumpSuit },
      trumpBroken,
      hands,
      currentTrick,
      completedTricks,
    },
  },
});

test("hard AI leads an off-suit ace before a low-trump bleed when big joker is unavailable", () => {
  const updated = reviewGameState(
    createPlayingGame({
      bids: [
        { playerId: "p1", amount: 2, trip: false },
        { playerId: "p2", amount: 1, trip: false },
        { playerId: "p3", amount: 1, trip: false },
        { playerId: "p4", amount: 1, trip: false },
      ],
      hands: [
        {
          playerId: "p1",
          cards: [
            { rank: "A", suit: "Hearts" },
            { rank: "4", suit: "Spades" },
            { rank: "Q", suit: "Spades" },
          ],
        },
        { playerId: "p2", cards: [{ rank: "3", suit: "Clubs" }] },
        { playerId: "p3", cards: [{ rank: "4", suit: "Clubs" }] },
        { playerId: "p4", cards: [{ rank: "5", suit: "Clubs" }] },
      ],
      currentTrick: undefined,
    }),
  );

  assert.equal(updated.phase.stage, "Playing");
  assert.equal(updated.phase.cards.currentTrick.plays.length, 1);
  assert.deepEqual(updated.phase.cards.currentTrick.plays[0], {
    playerId: "p1",
    card: { rank: "A", suit: "Hearts" },
  });
});

test("hard AI spends big joker over a little joker from another player", () => {
  const updated = reviewGameState(
    createPlayingGame({
      bids: [
        { playerId: "p1", amount: 1, trip: false },
        { playerId: "p2", amount: 2, trip: false },
        { playerId: "p3", amount: 1, trip: false },
        { playerId: "p4", amount: 1, trip: false },
      ],
      hands: [
        {
          playerId: "p1",
          cards: [
            { rank: "BJ", suit: "Joker" },
            { rank: "9", suit: "Clubs" },
          ],
        },
        { playerId: "p2", cards: [{ rank: "2", suit: "Diamonds" }] },
        { playerId: "p3", cards: [{ rank: "3", suit: "Diamonds" }] },
        { playerId: "p4", cards: [{ rank: "4", suit: "Diamonds" }] },
      ],
      currentTrick: {
        index: 0,
        leadPlayerId: "p2",
        plays: [
          { playerId: "p2", card: { rank: "7", suit: "Hearts" } },
          { playerId: "p3", card: { rank: "LJ", suit: "Joker" } },
          { playerId: "p4", card: { rank: "8", suit: "Hearts" } },
        ],
      },
    }),
  );

  assert.equal(updated.phase.cards.completedTricks.length, 1);
  assert.deepEqual(updated.phase.cards.completedTricks[0].plays[3], {
    playerId: "p1",
    card: { rank: "BJ", suit: "Joker" },
  });
  assert.equal(updated.phase.cards.completedTricks[0].winnerPlayerId, "p1");
});

test("hard AI takes a guaranteed trick with the lowest winning non-trump card", () => {
  const updated = reviewGameState(
    createPlayingGame({
      bids: [
        { playerId: "p1", amount: 1, trip: false },
        { playerId: "p2", amount: 1, trip: false },
        { playerId: "p3", amount: 1, trip: false },
        { playerId: "p4", amount: 1, trip: false },
      ],
      hands: [
        {
          playerId: "p1",
          cards: [
            { rank: "A", suit: "Clubs" },
            { rank: "2", suit: "Spades" },
          ],
        },
        { playerId: "p2", cards: [{ rank: "4", suit: "Diamonds" }] },
        { playerId: "p3", cards: [{ rank: "5", suit: "Diamonds" }] },
        { playerId: "p4", cards: [{ rank: "6", suit: "Diamonds" }] },
      ],
      currentTrick: {
        index: 0,
        leadPlayerId: "p2",
        plays: [
          { playerId: "p2", card: { rank: "Q", suit: "Clubs" } },
          { playerId: "p3", card: { rank: "K", suit: "Clubs" } },
          { playerId: "p4", card: { rank: "3", suit: "Clubs" } },
        ],
      },
    }),
  );

  assert.equal(updated.phase.cards.completedTricks.length, 1);
  assert.deepEqual(updated.phase.cards.completedTricks[0].plays[3], {
    playerId: "p1",
    card: { rank: "A", suit: "Clubs" },
  });
  assert.equal(updated.phase.cards.completedTricks[0].winnerPlayerId, "p1");
});

test("reviewGameState plays through consecutive AI turns until a human turn is reached", () => {
  const updated = reviewGameState({
    id: "game-1",
    version: 1,
    ownerToken: "owner-token",
    options: {
      maxCards: 2,
      blindBid: false,
      aiDifficulty: "hard",
      rounds: [{ cardCount: 2, direction: "up" }],
    },
    players: [
      { id: "p1", name: "Robin", type: "human", connected: true },
      { id: "p2", name: "Casey", type: "human", connected: true },
      { id: "p3", name: "Bot Alpha", type: "ai", connected: true },
      { id: "p4", name: "Bot Beta", type: "ai", connected: true },
      { id: "p5", name: "Bot Gamma", type: "ai", connected: true },
    ],
    playerTokens: [
      { playerId: "p1", token: "token-1" },
      { playerId: "p2", token: "token-2" },
      { playerId: "p3", token: "token-3" },
      { playerId: "p4", token: "token-4" },
      { playerId: "p5", token: "token-5" },
    ],
    playerOrder: ["p1", "p2", "p3", "p4", "p5"],
    scores: [
      { playerId: "p1", total: 0, possible: 0, rounds: [] },
      { playerId: "p2", total: 0, possible: 0, rounds: [] },
      { playerId: "p3", total: 0, possible: 0, rounds: [] },
      { playerId: "p4", total: 0, possible: 0, rounds: [] },
      { playerId: "p5", total: 0, possible: 0, rounds: [] },
    ],
    reactions: [],
    phase: {
      stage: "Playing",
      dealerPlayerId: "p5",
      roundIndex: 0,
      trickIndex: 0,
      turnPlayerId: "p3",
      bids: [
        { playerId: "p1", amount: 1, trip: false },
        { playerId: "p2", amount: 1, trip: false },
        { playerId: "p3", amount: 1, trip: false },
        { playerId: "p4", amount: 1, trip: false },
        { playerId: "p5", amount: 1, trip: false },
      ],
      cards: {
        deck: [],
        trump: { rank: "2", suit: "Spades" },
        trumpBroken: true,
        hands: [
          { playerId: "p1", cards: [{ rank: "A", suit: "Clubs" }] },
          { playerId: "p2", cards: [{ rank: "K", suit: "Clubs" }] },
          { playerId: "p3", cards: [{ rank: "3", suit: "Clubs" }] },
          { playerId: "p4", cards: [{ rank: "4", suit: "Clubs" }] },
          { playerId: "p5", cards: [{ rank: "5", suit: "Clubs" }] },
        ],
        currentTrick: {
          index: 0,
          leadPlayerId: "p1",
          plays: [
            { playerId: "p1", card: { rank: "A", suit: "Clubs" } },
            { playerId: "p2", card: { rank: "K", suit: "Clubs" } },
          ],
        },
        completedTricks: [],
      },
    },
  });

  assert.equal(updated.phase.stage, "Playing");
  assert.equal(updated.phase.turnPlayerId, "p1");
  assert.equal(updated.phase.cards.completedTricks.length, 1);
  assert.equal(updated.phase.cards.completedTricks[0].plays.length, 5);
  assert.equal(updated.phase.cards.completedTricks[0].winnerPlayerId, "p1");
});
