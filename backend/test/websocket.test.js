const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ApiGatewayManagementApiClient,
  GoneException,
} = require("@aws-sdk/client-apigatewaymanagementapi");
const {
  sendSocketResponse,
  filterLiveConnections,
  broadcastGameState,
} = require("../dist/backend/src/websocket.js");
const getConnectionsByGameIdModule = require("../dist/backend/engine/helpers/reducer/storage/getConnectionsByGameId.js");
const getGameByIdModule = require("../dist/backend/engine/helpers/reducer/storage/getGameById.js");
const deleteConnectionByIdModule = require("../dist/backend/engine/helpers/reducer/storage/deleteConnectionById.js");

const goneError = () => new GoneException({ message: "gone", $metadata: {} });

const withSendMock = async (sendImpl, fn) => {
  const original = ApiGatewayManagementApiClient.prototype.send;
  ApiGatewayManagementApiClient.prototype.send = sendImpl;
  try {
    return await fn();
  } finally {
    ApiGatewayManagementApiClient.prototype.send = original;
  }
};

const withStorageMocks = async (mocks, fn) => {
  const originals = {
    getConnectionsByGameId: getConnectionsByGameIdModule.getConnectionsByGameId,
    getGameById: getGameByIdModule.getGameById,
    deleteConnectionById: deleteConnectionByIdModule.deleteConnectionById,
  };

  if (mocks.getConnectionsByGameId) {
    getConnectionsByGameIdModule.getConnectionsByGameId = mocks.getConnectionsByGameId;
  }
  if (mocks.getGameById) {
    getGameByIdModule.getGameById = mocks.getGameById;
  }
  if (mocks.deleteConnectionById) {
    deleteConnectionByIdModule.deleteConnectionById = mocks.deleteConnectionById;
  }

  try {
    return await fn();
  } finally {
    getConnectionsByGameIdModule.getConnectionsByGameId = originals.getConnectionsByGameId;
    getGameByIdModule.getGameById = originals.getGameById;
    deleteConnectionByIdModule.deleteConnectionById = originals.deleteConnectionById;
  }
};

const createGame = (overrides = {}) => ({
  id: "game-1",
  version: 1,
  ownerToken: "owner-token",
  options: { maxCards: 10, blindBid: false, aiDifficulty: "medium", rounds: [] },
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
  ...overrides,
});

test("sendSocketResponse posts the serialized message to the connection", async () => {
  const calls = [];

  await withSendMock(
    async function mockSend(command) {
      calls.push(command);
      return {};
    },
    () =>
      sendSocketResponse("domain.example", "prod", "conn-1", {
        type: "response",
        requestId: "req-1",
        ok: true,
        result: { hello: "world" },
      }),
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].input.ConnectionId, "conn-1");
  assert.deepEqual(JSON.parse(calls[0].input.Data), {
    type: "response",
    requestId: "req-1",
    ok: true,
    result: { hello: "world" },
  });
});

test("sendSocketResponse cleans up a stale connection on GoneException", async () => {
  let deleteCalledWith;
  const calls = [];

  await withStorageMocks(
    {
      deleteConnectionById: async (connectionId) => {
        deleteCalledWith = connectionId;
      },
    },
    () =>
      withSendMock(
        async function mockSend(command) {
          calls.push(command);
          if (command.constructor.name === "PostToConnectionCommand") {
            throw goneError();
          }
          return {};
        },
        () =>
          sendSocketResponse("domain.example", "prod", "conn-stale", {
            type: "response",
            requestId: "req-1",
            ok: true,
            result: {},
          }),
      ),
  );

  assert.equal(deleteCalledWith, "conn-stale");
  assert.equal(calls.some((command) => command.constructor.name === "DeleteConnectionCommand"), true);
});

test("sendSocketResponse rejects when the client throws a non-Gone error", async () => {
  await assert.rejects(
    () =>
      withSendMock(
        async () => {
          throw new Error("network exploded");
        },
        () =>
          sendSocketResponse("domain.example", "prod", "conn-1", {
            type: "response",
            requestId: "req-1",
            ok: true,
            result: {},
          }),
      ),
    /network exploded/,
  );
});

test("filterLiveConnections keeps connections that respond successfully", async () => {
  const connections = [
    { connectionId: "conn-1", gameId: "game-1", playerToken: "token-1" },
    { connectionId: "conn-2", gameId: "game-1", playerToken: "token-2" },
  ];

  const live = await withSendMock(
    async () => ({}),
    () => filterLiveConnections("domain.example", "prod", connections),
  );

  assert.deepEqual(live, connections);
});

test("filterLiveConnections drops connections that report Gone and deletes them", async () => {
  const connections = [
    { connectionId: "conn-1", gameId: "game-1", playerToken: "token-1" },
    { connectionId: "conn-2", gameId: "game-1", playerToken: "token-2" },
  ];
  const deletedIds = [];

  const live = await withStorageMocks(
    {
      deleteConnectionById: async (connectionId) => {
        deletedIds.push(connectionId);
      },
    },
    () =>
      withSendMock(
        async () => {
          throw goneError();
        },
        () => filterLiveConnections("domain.example", "prod", connections),
      ),
  );

  assert.deepEqual(live, []);
  assert.deepEqual(deletedIds.sort(), ["conn-1", "conn-2"]);
});

test("broadcastGameState notifies and removes connections when the game no longer exists", async () => {
  const connections = [{ connectionId: "conn-1", gameId: "game-1", playerToken: "token-1" }];
  const deletedIds = [];
  const sentMessages = [];

  await withStorageMocks(
    {
      getConnectionsByGameId: async () => connections,
      getGameById: async () => undefined,
      deleteConnectionById: async (connectionId) => {
        deletedIds.push(connectionId);
      },
    },
    () =>
      withSendMock(
        async function mockSend(command) {
          if (command.constructor.name === "PostToConnectionCommand") {
            sentMessages.push(JSON.parse(command.input.Data));
          }
          return {};
        },
        () => broadcastGameState("domain.example", "prod", "game-1"),
      ),
  );

  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].type, "gameRemoved");
  assert.deepEqual(deletedIds, ["conn-1"]);
});

test("broadcastGameState removes a connection whose player no longer has a seat", async () => {
  const connections = [{ connectionId: "conn-1", gameId: "game-1", playerToken: "removed-token" }];
  const deletedIds = [];
  const sentMessages = [];
  const game = createGame();

  await withStorageMocks(
    {
      getConnectionsByGameId: async () => connections,
      getGameById: async () => game,
      deleteConnectionById: async (connectionId) => {
        deletedIds.push(connectionId);
      },
    },
    () =>
      withSendMock(
        async function mockSend(command) {
          if (command.constructor.name === "PostToConnectionCommand") {
            sentMessages.push(JSON.parse(command.input.Data));
          }
          return {};
        },
        () => broadcastGameState("domain.example", "prod", "game-1"),
      ),
  );

  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].type, "playerRemoved");
  assert.deepEqual(deletedIds, ["conn-1"]);
});

test("broadcastGameState sends a personalized game state to each live connection", async () => {
  const connections = [{ connectionId: "conn-1", gameId: "game-1", playerToken: "owner-token" }];
  const sentMessages = [];
  const game = createGame();

  await withStorageMocks(
    {
      getConnectionsByGameId: async () => connections,
      getGameById: async () => game,
    },
    () =>
      withSendMock(
        async function mockSend(command) {
          if (command.constructor.name === "PostToConnectionCommand") {
            sentMessages.push(JSON.parse(command.input.Data));
          }
          return {};
        },
        () => broadcastGameState("domain.example", "prod", "game-1"),
      ),
  );

  assert.equal(sentMessages.length, 1);
  assert.equal(sentMessages[0].type, "gameState");
  assert.equal(sentMessages[0].gameId, "game-1");
  assert.equal(sentMessages[0].result.game.id, "game-1");
});
