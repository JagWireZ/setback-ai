const test = require("node:test");
const assert = require("node:assert/strict");

const { submitBid } = require("../dist/backend/engine/reducer/submitBid.js");

const createBiddingGame = (overrides = {}) => ({
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
    stage: "Bidding",
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
        { playerId: "p1", cards: [{ rank: "9", suit: "Hearts" }] },
        { playerId: "p2", cards: [{ rank: "K", suit: "Hearts" }] },
      ],
      currentTrick: undefined,
      completedTricks: [],
    },
  },
  ...overrides,
});

test("submitBid records a bid and advances to the next bidder", () => {
  const updated = submitBid(createBiddingGame(), {
    action: "submitBid",
    payload: {
      gameId: "game-1",
      playerToken: "token-1",
      bid: 2,
    },
  });

  assert.equal(updated.version, 2);
  assert.equal(updated.phase.stage, "Bidding");
  assert.equal(updated.phase.turnPlayerId, "p2");
  assert.deepEqual(updated.phase.bids, [{ playerId: "p1", amount: 2, trip: false }]);
});

test("submitBid advances to the Playing phase once every player has bid", () => {
  const game = createBiddingGame({
    phase: {
      stage: "Bidding",
      dealerPlayerId: "p2",
      roundIndex: 0,
      trickIndex: 0,
      turnPlayerId: "p2",
      bids: [{ playerId: "p1", amount: 2, trip: false }],
      cards: createBiddingGame().phase.cards,
    },
  });

  const updated = submitBid(game, {
    action: "submitBid",
    payload: {
      gameId: "game-1",
      playerToken: "token-2",
      bid: 1,
    },
  });

  assert.equal(updated.phase.stage, "Playing");
  assert.equal(updated.phase.turnPlayerId, "p1");
});

test("submitBid rejects bidding outside the Bidding phase", () => {
  assert.throws(
    () =>
      submitBid(createBiddingGame({ phase: { stage: "Playing" } }), {
        action: "submitBid",
        payload: {
          gameId: "game-1",
          playerToken: "token-1",
          bid: 2,
        },
      }),
    /only be submitted during bidding phase/i,
  );
});

test("submitBid rejects a bid when it is not the player's turn", () => {
  assert.throws(
    () =>
      submitBid(createBiddingGame(), {
        action: "submitBid",
        payload: {
          gameId: "game-1",
          playerToken: "token-2",
          bid: 1,
        },
      }),
    /not this player's turn to bid/i,
  );
});

test("submitBid rejects a duplicate bid from the same player", () => {
  const game = createBiddingGame({
    phase: {
      ...createBiddingGame().phase,
      bids: [{ playerId: "p1", amount: 1, trip: false }],
    },
  });

  assert.throws(
    () =>
      submitBid(game, {
        action: "submitBid",
        payload: {
          gameId: "game-1",
          playerToken: "token-1",
          bid: 2,
        },
      }),
    /already submitted a bid/i,
  );
});

test("submitBid rejects a bid amount outside the legal range", () => {
  assert.throws(
    () =>
      submitBid(createBiddingGame(), {
        action: "submitBid",
        payload: {
          gameId: "game-1",
          playerToken: "token-1",
          bid: 6,
        },
      }),
    /must be an integer from 0 to 5/i,
  );
});

test("submitBid rejects a trip request when the round has too many cards", () => {
  assert.throws(
    () =>
      submitBid(createBiddingGame(), {
        action: "submitBid",
        payload: {
          gameId: "game-1",
          playerToken: "token-1",
          bid: 5,
          trip: true,
        },
      }),
    /trip is only available when cardcount is 3, 2, or 1/i,
  );
});

test("submitBid allows a trip bid when the round supports it", () => {
  const game = createBiddingGame({
    options: {
      maxCards: 3,
      blindBid: false,
      aiDifficulty: "medium",
      rounds: [{ cardCount: 3, direction: "down" }],
    },
  });

  const updated = submitBid(game, {
    action: "submitBid",
    payload: {
      gameId: "game-1",
      playerToken: "token-1",
      bid: 0,
      trip: true,
    },
  });

  assert.deepEqual(updated.phase.bids, [{ playerId: "p1", amount: 3, trip: true }]);
});

test("submitBid rejects an invalid or stale player token", () => {
  assert.throws(
    () =>
      submitBid(createBiddingGame(), {
        action: "submitBid",
        payload: {
          gameId: "game-1",
          playerToken: "stale-token",
          bid: 1,
        },
      }),
    /invalid player token/i,
  );
});

test("submitBid rejects a game ID mismatch", () => {
  assert.throws(
    () =>
      submitBid(createBiddingGame(), {
        action: "submitBid",
        payload: {
          gameId: "wrong-game",
          playerToken: "token-1",
          bid: 1,
        },
      }),
    /game id mismatch/i,
  );
});
