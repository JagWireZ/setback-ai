const test = require("node:test");
const assert = require("node:assert/strict");

const {
  applyRainbowPreviewToScores,
  hasRainbow,
} = require("../dist/backend/engine/helpers/reducer/gameState/rainbow.js");
const { scoreRound } = require("../dist/backend/engine/helpers/reducer/gameState/scoreRound.js");

test("hasRainbow only succeeds in four-card rounds covering all suits", () => {
  assert.equal(
    hasRainbow(
      [
        { rank: "A", suit: "Clubs" },
        { rank: "K", suit: "Diamonds" },
        { rank: "Q", suit: "Hearts" },
        { rank: "J", suit: "Spades" },
      ],
      "Spades",
      4,
    ),
    true,
  );

  assert.equal(
    hasRainbow(
      [
        { rank: "A", suit: "Clubs" },
        { rank: "K", suit: "Diamonds" },
        { rank: "Q", suit: "Hearts" },
        { rank: "J", suit: "Spades" },
      ],
      "Spades",
      5,
    ),
    false,
  );
});

test("applyRainbowPreviewToScores awards rainbow bonus before bidding", () => {
  const updatedScores = applyRainbowPreviewToScores(
    [
      { playerId: "p1", total: 0, possible: 0, rounds: [] },
      { playerId: "p2", total: 0, possible: 0, rounds: [] },
    ],
    new Map([
      [
        "p1",
        [
          { rank: "A", suit: "Clubs" },
          { rank: "K", suit: "Diamonds" },
          { rank: "Q", suit: "Hearts" },
          { rank: "J", suit: "Spades" },
        ],
      ],
      [
        "p2",
        [
          { rank: "A", suit: "Clubs" },
          { rank: "K", suit: "Diamonds" },
          { rank: "Q", suit: "Hearts" },
          { rank: "J", suit: "Hearts" },
        ],
      ],
    ]),
    "Spades",
    0,
    4,
  );

  assert.equal(updatedScores[0].rounds[0].rainbow, true);
  assert.equal(updatedScores[0].rounds[0].total, 25);
  assert.equal(updatedScores[0].total, 25);
  assert.equal(updatedScores[1].rounds[0].rainbow, false);
  assert.equal(updatedScores[1].total, 0);
});

test("scoreRound replaces the previewed rainbow round instead of double-counting it", () => {
  const scores = scoreRound({
    id: "game-1",
    version: 1,
    ownerToken: "owner-token",
    options: {
      maxCards: 4,
      blindBid: false,
      rounds: [{ cardCount: 4, direction: "up" }],
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
        total: 25,
        possible: 0,
        rounds: [{ total: 25, possible: 0, rainbow: true, bid: 0, books: 0 }],
      },
      {
        playerId: "p2",
        total: 0,
        possible: 0,
        rounds: [{ total: 0, possible: 0, rainbow: false, bid: 0, books: 0 }],
      },
    ],
    phase: {
      stage: "Scoring",
      dealerPlayerId: "p1",
      roundIndex: 0,
      trickIndex: 0,
      bids: [
        { playerId: "p1", amount: 2, trip: false },
        { playerId: "p2", amount: 1, trip: false },
      ],
      cards: {
        deck: [],
        trump: { rank: "A", suit: "Spades" },
        trumpBroken: true,
        hands: [],
        completedTricks: [
          {
            index: 0,
            leadPlayerId: "p1",
            winnerPlayerId: "p1",
            plays: [
              { playerId: "p1", card: { rank: "A", suit: "Clubs" } },
              { playerId: "p2", card: { rank: "2", suit: "Clubs" } },
            ],
          },
          {
            index: 1,
            leadPlayerId: "p1",
            winnerPlayerId: "p1",
            plays: [
              { playerId: "p1", card: { rank: "K", suit: "Diamonds" } },
              { playerId: "p2", card: { rank: "2", suit: "Diamonds" } },
            ],
          },
          {
            index: 2,
            leadPlayerId: "p1",
            winnerPlayerId: "p2",
            plays: [
              { playerId: "p1", card: { rank: "Q", suit: "Hearts" } },
              { playerId: "p2", card: { rank: "A", suit: "Hearts" } },
            ],
          },
          {
            index: 3,
            leadPlayerId: "p1",
            winnerPlayerId: "p1",
            plays: [
              { playerId: "p1", card: { rank: "J", suit: "Spades" } },
              { playerId: "p2", card: { rank: "2", suit: "Hearts" } },
            ],
          },
        ],
      },
    },
  });

  const playerOne = scores.find((score) => score.playerId === "p1");
  assert.equal(playerOne.rounds.length, 1);
  assert.equal(playerOne.rounds[0].rainbow, true);
  assert.equal(playerOne.rounds[0].total, 46);
  assert.equal(playerOne.total, 46);
});
