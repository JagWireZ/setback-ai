const test = require("node:test");
const assert = require("node:assert/strict");

const { advancePhase } = require("../dist/backend/engine/helpers/reducer/gameState/advancePhase.js");

const baseGame = (overrides = {}) => ({
  id: "game-1",
  version: 1,
  ownerToken: "owner-token",
  options: {
    maxCards: 5,
    blindBid: false,
    aiDifficulty: "medium",
    rounds: [{ cardCount: 1, direction: "up" }, { cardCount: 2, direction: "up" }],
  },
  players: [
    { id: "p1", name: "Player 1", type: "human", connected: true },
    { id: "p2", name: "Player 2", type: "human", connected: true },
    { id: "p3", name: "Player 3", type: "human", connected: true },
  ],
  playerTokens: [
    { playerId: "p1", token: "token-1" },
    { playerId: "p2", token: "token-2" },
    { playerId: "p3", token: "token-3" },
  ],
  playerOrder: ["p1", "p2", "p3"],
  scores: [],
  reactions: [],
  phase: { stage: "Lobby" },
  ...overrides,
});

test("advancePhase from Lobby throws when there are no rounds configured", () => {
  const game = baseGame({ options: { maxCards: 5, blindBid: false, aiDifficulty: "medium", rounds: [] } });

  assert.throws(() => advancePhase(game), /Cannot advance phase without rounds configured/);
});

test("advancePhase from Lobby throws when there are no players", () => {
  const game = baseGame({ playerOrder: [] });

  assert.throws(() => advancePhase(game), /Cannot advance phase without players/);
});

test("advancePhase from Lobby builds a Dealing phase with the first dealer and a shuffled deck", () => {
  const phase = advancePhase(baseGame());

  assert.equal(phase.stage, "Dealing");
  assert.equal(phase.dealerPlayerId, "p1");
  assert.equal(phase.turnPlayerId, "p1");
  assert.equal(phase.roundIndex, 0);
  assert.equal(phase.trickIndex, 0);
  assert.deepEqual(phase.bids, []);
  assert.equal(phase.cards.deck.length, 54);
  assert.equal(phase.cards.trump, undefined);
  assert.equal(phase.cards.trumpBroken, false);
  assert.deepEqual(
    phase.cards.hands.map((hand) => hand.playerId),
    ["p1", "p2", "p3"],
  );
  phase.cards.hands.forEach((hand) => assert.deepEqual(hand.cards, []));
  assert.deepEqual(phase.cards.completedTricks, []);
});

test("advancePhase from Dealing moves to Bidding with the next player after the dealer", () => {
  const game = baseGame({
    phase: {
      stage: "Dealing",
      dealerPlayerId: "p2",
      turnPlayerId: "p2",
      roundIndex: 0,
      trickIndex: 0,
      bids: [],
      cards: { deck: [], trumpBroken: false, hands: [], completedTricks: [] },
    },
  });

  const phase = advancePhase(game);

  assert.equal(phase.stage, "Bidding");
  assert.equal(phase.dealerPlayerId, "p2");
  assert.equal(phase.turnPlayerId, "p3");
});

test("advancePhase from Dealing throws if the dealer is not in the player order", () => {
  const game = baseGame({
    phase: {
      stage: "Dealing",
      dealerPlayerId: "missing",
      turnPlayerId: "missing",
      roundIndex: 0,
      trickIndex: 0,
      bids: [],
      cards: { deck: [], trumpBroken: false, hands: [], completedTricks: [] },
    },
  });

  assert.throws(() => advancePhase(game), /Dealer player is not in player order/);
});

test("advancePhase from Bidding throws when there are no bids", () => {
  const game = baseGame({
    phase: {
      stage: "Bidding",
      dealerPlayerId: "p1",
      turnPlayerId: "p3",
      roundIndex: 0,
      trickIndex: 0,
      bids: [],
      cards: { deck: [], trumpBroken: false, hands: [], completedTricks: [] },
    },
  });

  assert.throws(() => advancePhase(game), /Cannot enter playing phase without bids/);
});

test("advancePhase from Bidding moves to Playing with the first player after the dealer holding the highest bid", () => {
  const game = baseGame({
    phase: {
      stage: "Bidding",
      dealerPlayerId: "p1",
      turnPlayerId: "p1",
      roundIndex: 0,
      trickIndex: 0,
      bids: [
        { playerId: "p1", amount: 2, trip: false },
        { playerId: "p2", amount: 4, trip: false },
        { playerId: "p3", amount: 4, trip: false },
      ],
      cards: { deck: [], trumpBroken: false, hands: [], completedTricks: [] },
    },
  });

  const phase = advancePhase(game);

  assert.equal(phase.stage, "Playing");
  // p2 is the first player after the dealer (p1) among those tied for the highest bid (p2, p3).
  assert.equal(phase.turnPlayerId, "p2");
});

test("advancePhase from Bidding breaks ties in player order starting after the dealer", () => {
  const game = baseGame({
    phase: {
      stage: "Bidding",
      dealerPlayerId: "p2",
      turnPlayerId: "p2",
      roundIndex: 0,
      trickIndex: 0,
      bids: [
        { playerId: "p1", amount: 4, trip: false },
        { playerId: "p2", amount: 1, trip: false },
        { playerId: "p3", amount: 4, trip: false },
      ],
      cards: { deck: [], trumpBroken: false, hands: [], completedTricks: [] },
    },
  });

  const phase = advancePhase(game);

  // After dealer p2, order is p3 then p1; p3 has the highest bid first.
  assert.equal(phase.turnPlayerId, "p3");
});

test("advancePhase from Bidding throws if the dealer is not in the player order", () => {
  const game = baseGame({
    phase: {
      stage: "Bidding",
      dealerPlayerId: "missing",
      turnPlayerId: "p1",
      roundIndex: 0,
      trickIndex: 0,
      bids: [{ playerId: "p1", amount: 1, trip: false }],
      cards: { deck: [], trumpBroken: false, hands: [], completedTricks: [] },
    },
  });

  assert.throws(() => advancePhase(game), /Dealer player is not in player order/);
});

test("advancePhase from Playing moves to Scoring and drops turnPlayerId", () => {
  const game = baseGame({
    phase: {
      stage: "Playing",
      dealerPlayerId: "p1",
      turnPlayerId: "p2",
      roundIndex: 0,
      trickIndex: 3,
      bids: [{ playerId: "p1", amount: 1, trip: false }],
      cards: { deck: [], trumpBroken: true, hands: [], completedTricks: [] },
    },
  });

  const phase = advancePhase(game);

  assert.equal(phase.stage, "Scoring");
  assert.equal(phase.turnPlayerId, undefined);
  assert.equal(phase.dealerPlayerId, "p1");
  assert.equal(phase.trickIndex, 3);
});

test("advancePhase from Scoring always throws", () => {
  const game = baseGame({
    phase: {
      stage: "Scoring",
      dealerPlayerId: "p1",
      roundIndex: 0,
      trickIndex: 0,
      bids: [],
      cards: { deck: [], trumpBroken: false, hands: [], completedTricks: [] },
    },
  });

  assert.throws(() => advancePhase(game), /Scoring phase should transition through EndOfRound/);
});

test("advancePhase from EndOfRound deals the next round when more rounds remain", () => {
  const game = baseGame({
    phase: {
      stage: "EndOfRound",
      dealerPlayerId: "p1",
      roundIndex: 0,
      trickIndex: 0,
      bids: [],
      advanceAfter: Date.now(),
      cards: { deck: [], trumpBroken: false, hands: [], completedTricks: [] },
    },
  });

  const phase = advancePhase(game);

  assert.equal(phase.stage, "Dealing");
  assert.equal(phase.roundIndex, 1);
  // Dealer rotates based on round index into the player order.
  assert.equal(phase.dealerPlayerId, "p2");
});

test("advancePhase from EndOfRound moves to GameOver on the last round", () => {
  const game = baseGame({
    phase: {
      stage: "EndOfRound",
      dealerPlayerId: "p1",
      roundIndex: 1,
      trickIndex: 0,
      bids: [],
      advanceAfter: Date.now(),
      cards: { deck: [], trumpBroken: false, hands: [], completedTricks: [] },
    },
  });

  const phase = advancePhase(game);

  assert.deepEqual(phase, { stage: "GameOver" });
});

test("advancePhase from GameOver always throws", () => {
  const game = baseGame({ phase: { stage: "GameOver" } });

  assert.throws(() => advancePhase(game), /Cannot advance phase after game is over/);
});

test("advancePhase throws on an unrecognized phase stage", () => {
  const game = baseGame({ phase: { stage: "NotARealStage" } });

  assert.throws(() => advancePhase(game), /Unhandled action/);
});
