const test = require("node:test");
const assert = require("node:assert/strict");

const { setPlayerAway } = require("../dist/backend/engine/reducer/setPlayerAway.js");

const createGame = () => ({
  id: "game-1",
  version: 1,
  ownerToken: "owner-token",
  options: {
    maxCards: 5,
    blindBid: false,
    aiDifficulty: "medium",
    rounds: [],
  },
  players: [
    { id: "p1", name: "Owner", type: "human", connected: true },
    { id: "p2", name: "Robin", type: "human", connected: true },
    { id: "p3", name: "Bot", type: "ai", connected: true },
  ],
  playerTokens: [
    { playerId: "p1", token: "owner-token" },
    { playerId: "p2", token: "token-2" },
    { playerId: "p3", token: "token-3" },
  ],
  playerOrder: ["p1", "p2", "p3"],
  scores: [],
  reactions: [],
  phase: { stage: "Lobby" },
});

test("setPlayerAway marks a non-owner human as disconnected", () => {
  const updated = setPlayerAway(createGame(), {
    action: "setPlayerAway",
    payload: {
      gameId: "game-1",
      playerToken: "owner-token",
      playerId: "p2",
    },
  });

  assert.equal(updated.version, 2);
  assert.equal(updated.players.find((player) => player.id === "p2")?.presence?.connected, false);
  assert.equal(updated.players.find((player) => player.id === "p2")?.presence?.away, true);
});

test("setPlayerAway rejects marking an AI as away", () => {
  assert.throws(
    () =>
      setPlayerAway(createGame(), {
        action: "setPlayerAway",
        payload: {
          gameId: "game-1",
          playerToken: "owner-token",
          playerId: "p3",
        },
      }),
    /only human players/i,
  );
});
