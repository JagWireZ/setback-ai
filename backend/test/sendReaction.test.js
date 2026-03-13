const test = require("node:test");
const assert = require("node:assert/strict");

const { sendReaction } = require("../dist/backend/engine/reducer/sendReaction.js");
const { REACTION_COOLDOWN_MS } = require("../dist/backend/engine/helpers/reducer/gameState/reactions.js");

const createGame = () => ({
  id: "game-1",
  version: 1,
  ownerToken: "owner-token",
  options: {
    maxCards: 5,
    blindBid: false,
    rounds: [{ cardCount: 5, direction: "up" }],
  },
  players: [
    { id: "p1", name: "Casey", type: "human", connected: true },
    { id: "p2", name: "Robin", type: "human", connected: true },
  ],
  playerTokens: [
    { playerId: "p1", token: "token-1" },
    { playerId: "p2", token: "token-2" },
  ],
  playerOrder: ["p1", "p2"],
  scores: [],
  reactions: [],
  phase: { stage: "Lobby" },
});

test("sendReaction records the authenticated player's emoji reaction", () => {
  const updated = sendReaction(createGame(), {
    action: "sendReaction",
    payload: {
      gameId: "game-1",
      playerToken: "token-2",
      emoji: "🔥",
    },
  });

  assert.equal(updated.reactions.length, 1);
  assert.equal(updated.reactions[0].playerId, "p2");
  assert.equal(updated.reactions[0].emoji, "🔥");
  assert.ok(updated.reactions[0].id.includes("p2-"));
});

test("sendReaction rejects an invalid player token", () => {
  assert.throws(
    () =>
      sendReaction(createGame(), {
        action: "sendReaction",
        payload: {
          gameId: "game-1",
          playerToken: "bad-token",
          emoji: "👏",
        },
      }),
    /invalid player token/i,
  );
});

test("sendReaction ignores extra reactions from the same player inside 5 seconds", () => {
  const originalNow = Date.now;

  try {
    Date.now = () => 1_000;
    const initial = sendReaction(createGame(), {
      action: "sendReaction",
      payload: {
        gameId: "game-1",
        playerToken: "token-2",
        emoji: "🔥",
      },
    });

    Date.now = () => 1_000 + REACTION_COOLDOWN_MS - 1;
    const ignored = sendReaction(initial, {
      action: "sendReaction",
      payload: {
        gameId: "game-1",
        playerToken: "token-2",
        emoji: "👏",
      },
    });

    assert.equal(ignored, initial);
    assert.equal(ignored.reactions.length, 1);
    assert.equal(ignored.reactions[0].emoji, "🔥");
  } finally {
    Date.now = originalNow;
  }
});
