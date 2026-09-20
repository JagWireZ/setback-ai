const test = require("node:test");
const assert = require("node:assert/strict");

const { dealCards } = require("../dist/backend/engine/reducer/dealCards.js");

const createDealingGame = (overrides = {}) => ({
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
    stage: "Dealing",
    dealerPlayerId: "p1",
    roundIndex: 0,
    trickIndex: 0,
    turnPlayerId: "p1",
    bids: [],
    cards: {
      deck: [],
      trump: undefined,
      trumpBroken: false,
      hands: [
        { playerId: "p1", cards: [] },
        { playerId: "p2", cards: [] },
      ],
      completedTricks: [],
    },
  },
  ...overrides,
});

test("dealCards deals a full hand to every player and advances to Bidding", () => {
  const updated = dealCards(createDealingGame(), {
    action: "dealCards",
    payload: {
      gameId: "game-1",
      playerToken: "token-1",
    },
  });

  assert.equal(updated.version, 2);
  assert.equal(updated.phase.stage, "Bidding");
  assert.equal(updated.phase.turnPlayerId, "p2");
  for (const hand of updated.phase.cards.hands) {
    assert.equal(hand.cards.length, 5);
  }
  assert.ok(updated.phase.cards.trump);
  assert.notEqual(updated.phase.cards.trump.suit, "Joker");
  assert.equal(updated.phase.cards.trumpBroken, false);
});

test("dealCards rejects dealing outside the Dealing phase", () => {
  assert.throws(
    () =>
      dealCards(createDealingGame({ phase: { stage: "Bidding" } }), {
        action: "dealCards",
        payload: {
          gameId: "game-1",
          playerToken: "token-1",
        },
      }),
    /only be dealt during dealing phase/i,
  );
});

test("dealCards rejects a non-dealer attempting to deal", () => {
  const game = createDealingGame({
    phase: {
      ...createDealingGame().phase,
      dealerPlayerId: "p1",
      turnPlayerId: "p2",
    },
  });

  assert.throws(
    () =>
      dealCards(game, {
        action: "dealCards",
        payload: {
          gameId: "game-1",
          playerToken: "token-2",
        },
      }),
    /only the dealer can deal cards/i,
  );
});

test("dealCards rejects a stale or invalid player token", () => {
  assert.throws(
    () =>
      dealCards(createDealingGame(), {
        action: "dealCards",
        payload: {
          gameId: "game-1",
          playerToken: "stale-token",
        },
      }),
    /invalid player token/i,
  );
});

test("dealCards rejects a game ID mismatch", () => {
  assert.throws(
    () =>
      dealCards(createDealingGame(), {
        action: "dealCards",
        payload: {
          gameId: "wrong-game",
          playerToken: "token-1",
        },
      }),
    /game id mismatch/i,
  );
});
