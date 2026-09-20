const test = require("node:test");
const assert = require("node:assert/strict");

const reviewGameStateModule = require("../dist/backend/engine/ai/reviewGameState.js");
const turnTimingModule = require("../dist/backend/engine/helpers/reducer/gameState/turnTiming.js");
const { reviewGameState, applyAutomationStep } = reviewGameStateModule;

// aiBid.test.js and aiPlay.test.js already exercise reviewGameState's bid/play selection
// heuristics for "ai" type players. These tests cover the surrounding decision logic in
// reviewGameState.ts that isn't touched by those files: the EndOfRound/Scoring stopping
// conditions, controlledPlayerId-based automation of "away" human turns, and the
// MAX_REVIEW_STEPS guard.

const MODULES = {
  advanceDueAutomation: reviewGameStateModule,
  applyAutomationStep: reviewGameStateModule,
  normalizeTurnDueAt: turnTimingModule,
};

const withMocks = (mocks, fn) => {
  const originals = {};
  for (const [name, impl] of Object.entries(mocks)) {
    const targetModule = MODULES[name];
    originals[name] = targetModule[name];
    targetModule[name] = impl;
  }

  try {
    return fn();
  } finally {
    for (const [name] of Object.entries(mocks)) {
      MODULES[name][name] = originals[name];
    }
  }
};

const createBiddingGame = ({ turnPlayerType, turnPlayerConnected }) => ({
  id: "game-1",
  version: 1,
  ownerToken: "owner-token",
  options: {
    maxCards: 10,
    blindBid: false,
    aiDifficulty: "medium",
    rounds: [{ cardCount: 8, direction: "down" }],
  },
  players: [
    { id: "p1", name: "Turn Player", type: turnPlayerType, connected: turnPlayerConnected },
    { id: "p2", name: "Robin", type: "human", connected: true },
    { id: "p3", name: "Casey", type: "human", connected: true },
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
            { rank: "A", suit: "Hearts" },
            { rank: "K", suit: "Hearts" },
          ],
        },
        { playerId: "p2", cards: [] },
        { playerId: "p3", cards: [] },
        { playerId: "p4", cards: [] },
      ],
      completedTricks: [],
    },
  },
});

test("reviewGameState automates the bid of a disconnected ('away') human player on their turn", () => {
  const updated = reviewGameState(
    createBiddingGame({ turnPlayerType: "human", turnPlayerConnected: false }),
  );

  assert.equal(updated.phase.stage, "Bidding");
  assert.equal(updated.phase.bids.length, 1);
  assert.equal(updated.phase.bids[0].playerId, "p1");
  assert.equal(updated.phase.turnPlayerId, "p2");
});

test("reviewGameState does not automate a connected human player's turn", () => {
  const game = createBiddingGame({ turnPlayerType: "human", turnPlayerConnected: true });
  const updated = reviewGameState(game);

  assert.equal(updated.phase.bids.length, 0);
  assert.equal(updated.phase.turnPlayerId, "p1");
});

test("applyAutomationStep leaves an away human player's turn alone without a controlling player id", () => {
  const game = createBiddingGame({ turnPlayerType: "human", turnPlayerConnected: false });

  const result = applyAutomationStep(game);

  assert.equal(result, undefined);
});

test("reviewGameState advances an EndOfRound phase into GameOver immediately, ignoring advanceAfter", () => {
  const game = {
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
      { id: "p1", name: "Robin", type: "human", connected: true },
      { id: "p2", name: "Casey", type: "human", connected: true },
    ],
    playerTokens: [
      { playerId: "p1", token: "token-1" },
      { playerId: "p2", token: "token-2" },
    ],
    playerOrder: ["p1", "p2"],
    scores: [
      { playerId: "p1", total: 10, possible: 10, rounds: [{ total: 10, possible: 10, rainbow: false, bid: 1, books: 1 }] },
      { playerId: "p2", total: -10, possible: 0, rounds: [{ total: -10, possible: 0, rainbow: false, bid: 1, books: 0 }] },
    ],
    reactions: [],
    phase: {
      stage: "EndOfRound",
      dealerPlayerId: "p2",
      roundIndex: 0,
      trickIndex: 4,
      bids: [
        { playerId: "p1", amount: 1, trip: false },
        { playerId: "p2", amount: 1, trip: false },
      ],
      cards: {
        deck: [],
        trump: { rank: "2", suit: "Hearts" },
        trumpBroken: true,
        currentTrick: undefined,
        hands: [
          { playerId: "p1", cards: [] },
          { playerId: "p2", cards: [] },
        ],
        completedTricks: [],
      },
      // Far in the future: applyAutomationStepForPlayer's own EndOfRound handling checks
      // this against the real Date.now(), but reviewGameState calls advanceDueAutomation
      // with Number.POSITIVE_INFINITY, so it advances immediately regardless.
      advanceAfter: Date.now() + 1_000_000,
    },
  };

  const updated = reviewGameState(game);

  assert.equal(updated.phase.stage, "GameOver");
  assert.equal(updated.version, game.version + 1);
});

test("reviewGameState throws once it exceeds the maximum number of review steps", () => {
  let version = 0;

  withMocks(
    {
      normalizeTurnDueAt: (input) => input,
      advanceDueAutomation: () => {
        version += 1;
        return { id: "game-1", version };
      },
    },
    () => {
      assert.throws(
        () => reviewGameState({ id: "game-1", version: 0 }),
        /Game state review exceeded step limit/,
      );
    },
  );
});
