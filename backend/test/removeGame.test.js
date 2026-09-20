const test = require("node:test");
const assert = require("node:assert/strict");

const { removeGame } = require("../dist/backend/engine/reducer/removeGame.js");
const getGameByIdModule = require("../dist/backend/engine/helpers/reducer/storage/getGameById.js");
const deleteGameByIdModule = require("../dist/backend/engine/helpers/reducer/storage/deleteGameById.js");

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
  ],
  playerTokens: [
    { playerId: "p1", token: "owner-token" },
    { playerId: "p2", token: "token-2" },
  ],
  playerOrder: ["p1", "p2"],
  scores: [],
  reactions: [],
  phase: { stage: "Lobby" },
});

const withMocks = async (mocks, fn) => {
  const originals = {
    getGameById: getGameByIdModule.getGameById,
    deleteGameById: deleteGameByIdModule.deleteGameById,
  };

  if (mocks.getGameById) getGameByIdModule.getGameById = mocks.getGameById;
  if (mocks.deleteGameById) deleteGameByIdModule.deleteGameById = mocks.deleteGameById;

  try {
    return await fn();
  } finally {
    getGameByIdModule.getGameById = originals.getGameById;
    deleteGameByIdModule.deleteGameById = originals.deleteGameById;
  }
};

test("removeGame deletes the game when requested by the owner", async () => {
  const game = createLobbyGame();
  let deleteCalledWith;

  const result = await withMocks(
    {
      getGameById: async () => game,
      deleteGameById: async (gameId) => {
        deleteCalledWith = gameId;
      },
    },
    () =>
      removeGame({
        action: "removeGame",
        payload: {
          gameId: "game-1",
          playerToken: "owner-token",
        },
      }),
  );

  assert.deepEqual(result, {});
  assert.equal(deleteCalledWith, "game-1");
});

test("removeGame rejects a non-owner token", async () => {
  const game = createLobbyGame();

  await assert.rejects(
    () =>
      withMocks(
        {
          getGameById: async () => game,
          deleteGameById: async () => {
            throw new Error("deleteGameById should not be called");
          },
        },
        () =>
          removeGame({
            action: "removeGame",
            payload: {
              gameId: "game-1",
              playerToken: "token-2",
            },
          }),
      ),
    /owner token required/i,
  );
});

test("removeGame throws when the game does not exist", async () => {
  await assert.rejects(
    () =>
      withMocks(
        {
          getGameById: async () => undefined,
        },
        () =>
          removeGame({
            action: "removeGame",
            payload: {
              gameId: "missing-game",
              playerToken: "owner-token",
            },
          }),
      ),
    /game not found/i,
  );
});
