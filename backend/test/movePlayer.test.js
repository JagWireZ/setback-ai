const test = require("node:test");
const assert = require("node:assert/strict");

const { movePlayer } = require("../dist/backend/engine/reducer/movePlayer.js");

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
    { id: "p3", name: "Casey", type: "human", connected: true },
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

test("movePlayer swaps a player one seat to the left", () => {
  const updated = movePlayer(createLobbyGame(), {
    action: "movePlayer",
    payload: {
      gameId: "game-1",
      playerId: "p2",
      direction: "left",
    },
  });

  assert.equal(updated.version, 2);
  assert.deepEqual(updated.playerOrder, ["p2", "p1", "p3"]);
});

test("movePlayer swaps a player one seat to the right", () => {
  const updated = movePlayer(createLobbyGame(), {
    action: "movePlayer",
    payload: {
      gameId: "game-1",
      playerId: "p2",
      direction: "right",
    },
  });

  assert.equal(updated.version, 2);
  assert.deepEqual(updated.playerOrder, ["p1", "p3", "p2"]);
});

test("movePlayer wraps around when moving the first player left", () => {
  const updated = movePlayer(createLobbyGame(), {
    action: "movePlayer",
    payload: {
      gameId: "game-1",
      playerId: "p1",
      direction: "left",
    },
  });

  assert.deepEqual(updated.playerOrder, ["p3", "p2", "p1"]);
});

test("movePlayer rejects a game ID mismatch", () => {
  assert.throws(
    () =>
      movePlayer(createLobbyGame(), {
        action: "movePlayer",
        payload: {
          gameId: "wrong-game",
          playerId: "p2",
          direction: "left",
        },
      }),
    /game id mismatch/i,
  );
});

test("movePlayer rejects a player that is not in playerOrder", () => {
  assert.throws(
    () =>
      movePlayer(createLobbyGame(), {
        action: "movePlayer",
        payload: {
          gameId: "game-1",
          playerId: "ghost",
          direction: "left",
        },
      }),
    /not found in playerOrder/i,
  );
});

test("movePlayer rejects an invalid direction", () => {
  assert.throws(
    () =>
      movePlayer(createLobbyGame(), {
        action: "movePlayer",
        payload: {
          gameId: "game-1",
          playerId: "p2",
          direction: "up",
        },
      }),
    /must be "left" or "right"/i,
  );
});

test("movePlayer throws when the game does not exist", () => {
  assert.throws(
    () =>
      movePlayer(undefined, {
        action: "movePlayer",
        payload: {
          gameId: "game-1",
          playerId: "p2",
          direction: "left",
        },
      }),
    /game not found/i,
  );
});
