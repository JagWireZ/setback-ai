const test = require("node:test");
const assert = require("node:assert/strict");

const { playCard } = require("../dist/backend/engine/reducer/playCard.js");

const createPlayingGame = (overrides = {}) => ({
  id: "game-1",
  version: 1,
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
    { playerId: "p1", total: 0, possible: 0, rounds: [] },
    { playerId: "p2", total: 0, possible: 0, rounds: [] },
  ],
  phase: {
    stage: "Playing",
    dealerPlayerId: "p2",
    roundIndex: 0,
    trickIndex: 0,
    turnPlayerId: "p1",
    bids: [],
    cards: {
      deck: [],
      trump: { rank: "A", suit: "Spades" },
      trumpBroken: false,
      hands: [
        {
          playerId: "p1",
          cards: [
            { rank: "9", suit: "Hearts" },
            { rank: "A", suit: "Spades" },
          ],
        },
        {
          playerId: "p2",
          cards: [
            { rank: "K", suit: "Hearts" },
            { rank: "Q", suit: "Clubs" },
          ],
        },
      ],
      currentTrick: {
        index: 0,
        leadPlayerId: "p2",
        plays: [],
      },
      completedTricks: [],
    },
  },
  ...overrides,
});

test("playCard rejects a non-lead-suit card when the player can follow suit", () => {
  const game = createPlayingGame({
    phase: {
      stage: "Playing",
      dealerPlayerId: "p2",
      roundIndex: 0,
      trickIndex: 0,
      turnPlayerId: "p1",
      bids: [],
      cards: {
        deck: [],
        trump: { rank: "A", suit: "Spades" },
        trumpBroken: false,
        hands: [
          {
            playerId: "p1",
            cards: [
              { rank: "9", suit: "Hearts" },
              { rank: "A", suit: "Spades" },
            ],
          },
          {
            playerId: "p2",
            cards: [{ rank: "Q", suit: "Clubs" }],
          },
        ],
        currentTrick: {
          index: 0,
          leadPlayerId: "p2",
          plays: [{ playerId: "p2", card: { rank: "K", suit: "Hearts" } }],
        },
        completedTricks: [],
      },
    },
  });

  assert.throws(
    () =>
      playCard(game, {
        action: "playCard",
        payload: {
          gameId: "game-1",
          playerToken: "token-1",
          card: { rank: "A", suit: "Spades" },
        },
      }),
    /follow the leading suit/i,
  );
});

test("playCard rejects leading with trump before trump is broken when the player has a non-trump card", () => {
  const game = createPlayingGame();

  assert.throws(
    () =>
      playCard(game, {
        action: "playCard",
        payload: {
          gameId: "game-1",
          playerToken: "token-1",
          card: { rank: "A", suit: "Spades" },
        },
      }),
    /cannot lead with trump/i,
  );
});
