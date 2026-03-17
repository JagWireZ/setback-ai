const test = require("node:test");
const assert = require("node:assert/strict");

const { coverAwayPlayerTurn } = require("../dist/backend/engine/reducer/coverAwayPlayerTurn.js");

const REAL_DATE_NOW = Date.now;

const createPlayingGame = (overrides = {}) => ({
  id: "game-1",
  version: 1,
  ownerToken: "owner-token",
  options: {
    maxCards: 3,
    blindBid: false,
    aiDifficulty: "hard",
    rounds: [{ cardCount: 3, direction: "up" }],
  },
  players: [
    { id: "p1", name: "Owner", type: "human", connected: true, lastActiveAt: 1_000 },
    { id: "p2", name: "Robin", type: "human", connected: false, lastActiveAt: 1_000 },
    { id: "p3", name: "Casey", type: "human", connected: true, lastActiveAt: 1_000 },
    { id: "p4", name: "Jordan", type: "human", connected: true, lastActiveAt: 1_000 },
  ],
  playerTokens: [
    { playerId: "p1", token: "owner-token" },
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
    trickIndex: 0,
    turnPlayerId: "p2",
    turnStartedAt: 1_000,
    bids: [
      { playerId: "p1", amount: 1, trip: false },
      { playerId: "p2", amount: 1, trip: false },
      { playerId: "p3", amount: 0, trip: false },
      { playerId: "p4", amount: 1, trip: false },
    ],
    cards: {
      deck: [],
      trump: { rank: "2", suit: "Spades" },
      trumpBroken: false,
      hands: [
        { playerId: "p1", cards: [{ rank: "9", suit: "Hearts" }] },
        {
          playerId: "p2",
          cards: [
            { rank: "A", suit: "Clubs" },
            { rank: "2", suit: "Spades" },
          ],
        },
        { playerId: "p3", cards: [{ rank: "K", suit: "Hearts" }] },
        { playerId: "p4", cards: [{ rank: "Q", suit: "Hearts" }] },
      ],
      currentTrick: undefined,
      completedTricks: [],
    },
  },
  ...overrides,
});

test("coverAwayPlayerTurn plays one legal move for an away human on their turn", () => {
  const updated = coverAwayPlayerTurn(createPlayingGame(), {
    action: "coverAwayPlayerTurn",
    payload: {
      gameId: "game-1",
      playerToken: "owner-token",
      playerId: "p2",
    },
  });

  assert.equal(updated.version, 2);
  assert.equal(updated.phase.stage, "Playing");
  assert.equal(updated.phase.turnPlayerId, "p3");
  assert.deepEqual(updated.phase.cards.currentTrick.plays, [
    {
      playerId: "p2",
      card: { rank: "A", suit: "Clubs" },
    },
  ]);
});

test("coverAwayPlayerTurn rejects covering a player who is not away", () => {
  Date.now = () => 30_000;

  try {
    const game = createPlayingGame({
      players: [
        { id: "p1", name: "Owner", type: "human", connected: true, lastActiveAt: 29_000 },
        { id: "p2", name: "Robin", type: "human", connected: true, lastActiveAt: 29_000 },
        { id: "p3", name: "Casey", type: "human", connected: true, lastActiveAt: 29_000 },
        { id: "p4", name: "Jordan", type: "human", connected: true, lastActiveAt: 29_000 },
      ],
      phase: {
        ...createPlayingGame().phase,
        turnStartedAt: 29_000,
      },
    });

    assert.throws(
      () =>
        coverAwayPlayerTurn(game, {
          action: "coverAwayPlayerTurn",
          payload: {
            gameId: "game-1",
            playerToken: "owner-token",
            playerId: "p2",
          },
        }),
      /away or idle/i,
    );
  } finally {
    Date.now = REAL_DATE_NOW;
  }
});

test("coverAwayPlayerTurn covers an idle player on their turn and marks them away", () => {
  Date.now = () => 70_000;

  try {
    const game = createPlayingGame({
      players: [
        { id: "p1", name: "Owner", type: "human", connected: true, lastActiveAt: 5_000 },
        { id: "p2", name: "Robin", type: "human", connected: true, lastActiveAt: 5_000 },
        { id: "p3", name: "Casey", type: "human", connected: true, lastActiveAt: 5_000 },
        { id: "p4", name: "Jordan", type: "human", connected: true, lastActiveAt: 5_000 },
      ],
      phase: {
        ...createPlayingGame().phase,
        turnStartedAt: 5_000,
      },
    });

    const updated = coverAwayPlayerTurn(game, {
      action: "coverAwayPlayerTurn",
      payload: {
        gameId: "game-1",
        playerToken: "owner-token",
        playerId: "p2",
      },
    });

    assert.equal(updated.players.find((player) => player.id === "p2")?.presence?.away, true);
    assert.equal(updated.players.find((player) => player.id === "p2")?.presence?.connected, true);
    assert.equal(updated.phase.turnPlayerId, "p3");
  } finally {
    Date.now = REAL_DATE_NOW;
  }
});
