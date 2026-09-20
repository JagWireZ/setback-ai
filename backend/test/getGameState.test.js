const test = require("node:test");
const assert = require("node:assert/strict");

const { getGameState } = require("../dist/backend/engine/reducer/getGameState.js");
const getGameByIdModule = require("../dist/backend/engine/helpers/reducer/storage/getGameById.js");
const getGameVersionByIdModule = require("../dist/backend/engine/helpers/reducer/storage/getGameVersionById.js");
const putGameModule = require("../dist/backend/engine/helpers/reducer/storage/putGame.js");

const createLobbyGame = (overrides = {}) => ({
  id: "game-1",
  version: 3,
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
  scores: [
    { playerId: "p1", total: 0, possible: 0, rounds: [] },
    { playerId: "p2", total: 0, possible: 0, rounds: [] },
  ],
  reactions: [],
  phase: { stage: "Lobby" },
  ...overrides,
});

const withMocks = async (mocks, fn) => {
  const originals = {
    getGameById: getGameByIdModule.getGameById,
    getGameVersionById: getGameVersionByIdModule.getGameVersionById,
    putGame: putGameModule.putGame,
  };

  Object.assign(getGameByIdModule, mocks.getGameById ? { getGameById: mocks.getGameById } : {});
  Object.assign(
    getGameVersionByIdModule,
    mocks.getGameVersionById ? { getGameVersionById: mocks.getGameVersionById } : {},
  );
  Object.assign(putGameModule, mocks.putGame ? { putGame: mocks.putGame } : {});

  try {
    return await fn();
  } finally {
    getGameByIdModule.getGameById = originals.getGameById;
    getGameVersionByIdModule.getGameVersionById = originals.getGameVersionById;
    putGameModule.putGame = originals.putGame;
  }
};

test("getGameState returns the public game state when the client version is behind", async () => {
  const game = createLobbyGame();
  let putGameCalls = 0;

  const result = await withMocks(
    {
      getGameVersionById: async () => undefined,
      getGameById: async () => game,
      putGame: async () => {
        putGameCalls += 1;
      },
    },
    () =>
      getGameState(undefined, {
        action: "getGameState",
        payload: {
          gameId: "game-1",
          playerToken: "owner-token",
          version: 1,
        },
      }),
  );

  assert.ok(result.game);
  assert.equal(result.game.id, "game-1");
  assert.equal(result.version, 3);
  assert.equal(putGameCalls, 0);
});

test("getGameState returns only a version bump when the client is already current", async () => {
  const game = createLobbyGame();

  const result = await withMocks(
    {
      getGameVersionById: async () => undefined,
      getGameById: async () => game,
      putGame: async () => {},
    },
    () =>
      getGameState(undefined, {
        action: "getGameState",
        payload: {
          gameId: "game-1",
          playerToken: "owner-token",
          version: 3,
        },
      }),
  );

  assert.deepEqual(result, { version: 3 });
});

test("getGameState rejects a stale or invalid player token", async () => {
  const game = createLobbyGame();

  await assert.rejects(
    () =>
      withMocks(
        {
          getGameVersionById: async () => undefined,
          getGameById: async () => game,
        },
        () =>
          getGameState(undefined, {
            action: "getGameState",
            payload: {
              gameId: "game-1",
              playerToken: "stale-token",
              version: 0,
            },
          }),
      ),
    /invalid player token/i,
  );
});

test("getGameState rejects an invalid player token found via the version lookup", async () => {
  await assert.rejects(
    () =>
      withMocks(
        {
          getGameVersionById: async () => ({
            id: "game-version-1",
            playerTokens: [{ playerId: "p1", token: "owner-token" }],
          }),
        },
        () =>
          getGameState(undefined, {
            action: "getGameState",
            payload: {
              gameId: "game-1",
              playerToken: "stale-token",
              version: 0,
            },
          }),
      ),
    /invalid player token/i,
  );
});

test("getGameState throws when the game does not exist", async () => {
  await assert.rejects(
    () =>
      withMocks(
        {
          getGameVersionById: async () => undefined,
          getGameById: async () => undefined,
        },
        () =>
          getGameState(undefined, {
            action: "getGameState",
            payload: {
              gameId: "missing-game",
              playerToken: "owner-token",
              version: 0,
            },
          }),
      ),
    /game not found/i,
  );
});
