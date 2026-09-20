const test = require("node:test");
const assert = require("node:assert/strict");

const { sortCards } = require("../dist/backend/engine/reducer/sortCards.js");

const createPlayingGame = (overrides = {}) => ({
  id: "game-1",
  version: 1,
  ownerToken: "owner-token",
  options: {
    maxCards: 5,
    blindBid: false,
    aiDifficulty: "medium",
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
            { rank: "K", suit: "Hearts" },
            { rank: "2", suit: "Spades" },
            { rank: "9", suit: "Clubs" },
          ],
        },
        { playerId: "p2", cards: [{ rank: "Q", suit: "Clubs" }] },
      ],
      currentTrick: undefined,
      completedTricks: [],
    },
  },
  ...overrides,
});

test("sortCards sorts a player's hand by rank", () => {
  const updated = sortCards(createPlayingGame(), {
    action: "sortCards",
    payload: {
      gameId: "game-1",
      playerToken: "token-1",
      mode: "byRank",
    },
  });

  assert.equal(updated.version, 2);
  const hand = updated.phase.cards.hands.find((entry) => entry.playerId === "p1");
  assert.deepEqual(hand.cards, [
    { rank: "2", suit: "Spades" },
    { rank: "9", suit: "Clubs" },
    { rank: "K", suit: "Hearts" },
  ]);
});

test("sortCards sorts a player's hand by suit with trump last", () => {
  const updated = sortCards(createPlayingGame(), {
    action: "sortCards",
    payload: {
      gameId: "game-1",
      playerToken: "token-1",
      mode: "bySuit",
    },
  });

  const hand = updated.phase.cards.hands.find((entry) => entry.playerId === "p1");
  assert.deepEqual(hand.cards, [
    { rank: "9", suit: "Clubs" },
    { rank: "K", suit: "Hearts" },
    { rank: "2", suit: "Spades" },
  ]);
});

test("sortCards rejects sorting during the Dealing phase", () => {
  const game = createPlayingGame({
    phase: {
      stage: "Dealing",
      dealerPlayerId: "p2",
      turnPlayerId: "p2",
      roundIndex: 0,
      trickIndex: 0,
      bids: [],
      cards: createPlayingGame().phase.cards,
    },
  });

  assert.throws(
    () =>
      sortCards(game, {
        action: "sortCards",
        payload: {
          gameId: "game-1",
          playerToken: "token-1",
          mode: "byRank",
        },
      }),
    /cannot be sorted during dealing/i,
  );
});

test("sortCards rejects sorting when the phase has no cards", () => {
  assert.throws(
    () =>
      sortCards(createPlayingGame({ phase: { stage: "Lobby" } }), {
        action: "sortCards",
        payload: {
          gameId: "game-1",
          playerToken: "token-1",
          mode: "byRank",
        },
      }),
    /cannot be sorted in the current phase/i,
  );
});

test("sortCards rejects an invalid or stale player token", () => {
  assert.throws(
    () =>
      sortCards(createPlayingGame(), {
        action: "sortCards",
        payload: {
          gameId: "game-1",
          playerToken: "stale-token",
          mode: "byRank",
        },
      }),
    /invalid player token/i,
  );
});

test("sortCards rejects a game ID mismatch", () => {
  assert.throws(
    () =>
      sortCards(createPlayingGame(), {
        action: "sortCards",
        payload: {
          gameId: "wrong-game",
          playerToken: "token-1",
          mode: "byRank",
        },
      }),
    /game id mismatch/i,
  );
});
