const test = require("node:test");
const assert = require("node:assert/strict");

const { removePlayer } = require("../dist/backend/engine/reducer/removePlayer.js");

const createLobbyGame = () => ({
  id: "game-1",
  version: 1,
  ownerToken: "owner-token",
  options: {
    maxCards: 10,
    blindBid: false,
    aiDifficulty: "medium",
    rounds: [],
  },
  players: [
    { id: "p1", name: "Owner", type: "human", connected: true },
    { id: "p2", name: "Robin", type: "human", connected: true },
    { id: "p3", name: "Sharp Shuffle", type: "ai", connected: true },
  ],
  playerTokens: [
    { playerId: "p1", token: "owner-token" },
    { playerId: "p2", token: "token-2" },
    { playerId: "p3", token: "token-3" },
  ],
  playerOrder: ["p1", "p2", "p3"],
  scores: [
    { playerId: "p1", total: 0, possible: 0, rounds: [] },
    { playerId: "p2", total: 0, possible: 0, rounds: [] },
    { playerId: "p3", total: 0, possible: 0, rounds: [] },
  ],
  reactions: [],
  phase: { stage: "Lobby" },
});

test("removePlayer replaces a human player with an AI seat and rotates their token", () => {
  const updated = removePlayer(createLobbyGame(), {
    action: "removePlayer",
    payload: {
      gameId: "game-1",
      playerId: "p2",
    },
  });

  assert.equal(updated.version, 2);
  const replaced = updated.players.find((player) => player.id === "p2");
  assert.equal(replaced.type, "ai");
  assert.notEqual(replaced.name, "Robin");
  const replacedToken = updated.playerTokens.find((entry) => entry.playerId === "p2");
  assert.notEqual(replacedToken.token, "token-2");
});

test("removePlayer is a no-op when the target is already an AI seat", () => {
  const game = createLobbyGame();
  const updated = removePlayer(game, {
    action: "removePlayer",
    payload: {
      gameId: "game-1",
      playerId: "p3",
    },
  });

  assert.equal(updated, game);
});

test("removePlayer rejects removing the owner", () => {
  assert.throws(
    () =>
      removePlayer(createLobbyGame(), {
        action: "removePlayer",
        payload: {
          gameId: "game-1",
          playerId: "p1",
        },
      }),
    /owner player cannot be removed/i,
  );
});

test("removePlayer rejects an unknown player ID", () => {
  assert.throws(
    () =>
      removePlayer(createLobbyGame(), {
        action: "removePlayer",
        payload: {
          gameId: "game-1",
          playerId: "ghost",
        },
      }),
    /player not found/i,
  );
});

test("removePlayer rejects a game ID mismatch", () => {
  assert.throws(
    () =>
      removePlayer(createLobbyGame(), {
        action: "removePlayer",
        payload: {
          gameId: "wrong-game",
          playerId: "p2",
        },
      }),
    /game id mismatch/i,
  );
});
