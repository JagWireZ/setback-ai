const test = require("node:test");
const assert = require("node:assert/strict");

const { returnFromAway } = require("../dist/backend/engine/reducer/returnFromAway.js");

const createPlayingGame = (overrides = {}) => ({
  id: "game-1",
  version: 1,
  ownerToken: "owner-token",
  options: {
    maxCards: 3,
    blindBid: false,
    aiDifficulty: "medium",
    rounds: [{ cardCount: 3, direction: "up" }],
  },
  players: [
    {
      id: "p1",
      name: "Owner",
      type: "human",
      connected: true,
      presence: { connected: false, away: true, lastSeenAt: 1_000 },
    },
    { id: "p2", name: "Robin", type: "human", connected: true },
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
    turnPlayerId: "p2",
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

test("returnFromAway marks a player as connected and no longer away", () => {
  const updated = returnFromAway(createPlayingGame(), {
    action: "returnFromAway",
    payload: {
      gameId: "game-1",
      playerToken: "token-1",
    },
  });

  const player = updated.players.find((entry) => entry.id === "p1");
  assert.equal(player.presence.connected, true);
  assert.equal(player.presence.away, false);
});

test("returnFromAway keeps a player's presence connected and not away when already back", () => {
  const game = createPlayingGame({
    players: [
      { id: "p1", name: "Owner", type: "human", connected: true, presence: { connected: true, away: false, lastSeenAt: 5_000 } },
      { id: "p2", name: "Robin", type: "human", connected: true },
    ],
  });

  const updated = returnFromAway(game, {
    action: "returnFromAway",
    payload: {
      gameId: "game-1",
      playerToken: "token-1",
    },
  });

  const player = updated.players.find((entry) => entry.id === "p1");
  assert.equal(player.presence.connected, true);
  assert.equal(player.presence.away, false);
});

test("returnFromAway rejects an invalid or stale player token", () => {
  assert.throws(
    () =>
      returnFromAway(createPlayingGame(), {
        action: "returnFromAway",
        payload: {
          gameId: "game-1",
          playerToken: "stale-token",
        },
      }),
    /invalid player token/i,
  );
});

test("returnFromAway rejects a game ID mismatch", () => {
  assert.throws(
    () =>
      returnFromAway(createPlayingGame(), {
        action: "returnFromAway",
        payload: {
          gameId: "wrong-game",
          playerToken: "token-1",
        },
      }),
    /game id mismatch/i,
  );
});

test("returnFromAway throws when the game does not exist", () => {
  assert.throws(
    () =>
      returnFromAway(undefined, {
        action: "returnFromAway",
        payload: {
          gameId: "game-1",
          playerToken: "token-1",
        },
      }),
    /game not found/i,
  );
});
