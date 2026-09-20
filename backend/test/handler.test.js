const test = require("node:test");
const assert = require("node:assert/strict");

const { handler } = require("../dist/backend/src/handler.js");
const websocketModule = require("../dist/backend/src/websocket.js");
const getGameByIdModule = require("../dist/backend/engine/helpers/reducer/storage/getGameById.js");
const getConnectionByIdModule = require("../dist/backend/engine/helpers/reducer/storage/getConnectionById.js");
const deleteConnectionByIdModule = require("../dist/backend/engine/helpers/reducer/storage/deleteConnectionById.js");
const putConnectionModule = require("../dist/backend/engine/helpers/reducer/storage/putConnection.js");
const putGameModule = require("../dist/backend/engine/helpers/reducer/storage/putGame.js");

const MODULES = {
  sendSocketResponse: websocketModule,
  broadcastGameState: websocketModule,
  getGameById: getGameByIdModule,
  getConnectionById: getConnectionByIdModule,
  deleteConnectionById: deleteConnectionByIdModule,
  putConnection: putConnectionModule,
  putGame: putGameModule,
};

const withMocks = async (mocks, fn) => {
  const originals = {};
  for (const [name, impl] of Object.entries(mocks)) {
    const targetModule = MODULES[name];
    originals[name] = targetModule[name];
    targetModule[name] = impl;
  }

  try {
    return await fn();
  } finally {
    for (const [name] of Object.entries(mocks)) {
      MODULES[name][name] = originals[name];
    }
  }
};

const baseRequestContext = {
  connectionId: "conn-1",
  domainName: "domain.example",
  stage: "prod",
};

test("handler returns a no-content response for the $connect route", async () => {
  const result = await handler({
    requestContext: { ...baseRequestContext, routeKey: "$connect" },
  });

  assert.deepEqual(result, { statusCode: 200, body: "" });
});

test("handler rejects when the WebSocket request context is incomplete", async () => {
  await assert.rejects(
    () =>
      handler({
        requestContext: { routeKey: "$connect" },
      }),
    /missing websocket request context/i,
  );
});

test("handler on $disconnect deletes the connection record when none is found", async () => {
  let deleteCalledWith;

  const result = await withMocks(
    {
      getConnectionById: async () => undefined,
      deleteConnectionById: async (connectionId) => {
        deleteCalledWith = connectionId;
      },
    },
    () =>
      handler({
        requestContext: { ...baseRequestContext, routeKey: "$disconnect" },
      }),
  );

  assert.deepEqual(result, { statusCode: 200, body: "" });
  assert.equal(deleteCalledWith, "conn-1");
});

test("handler sends an error response for an unrecognized action on the default route", async () => {
  const responses = [];

  const result = await withMocks(
    {
      sendSocketResponse: async (_domain, _stage, _connectionId, message) => {
        responses.push(message);
      },
      getGameById: async () => undefined,
      putConnection: async () => {},
    },
    () =>
      handler({
        requestContext: { ...baseRequestContext, routeKey: "$default" },
        body: JSON.stringify({ requestId: "req-1", action: "doSomethingUnknown", payload: {} }),
      }),
  );

  assert.deepEqual(result, { statusCode: 200, body: "" });
  assert.equal(responses.length, 1);
  assert.equal(responses[0].ok, false);
  assert.equal(responses[0].requestId, "req-1");
  assert.ok(responses[0].error);
});

test("handler sends an error response when the action payload is malformed", async () => {
  const responses = [];

  await withMocks(
    {
      sendSocketResponse: async (_domain, _stage, _connectionId, message) => {
        responses.push(message);
      },
      getGameById: async () => undefined,
      putConnection: async () => {},
    },
    () =>
      handler({
        requestContext: { ...baseRequestContext, routeKey: "$default" },
        body: JSON.stringify({ requestId: "req-2", action: "createGame", payload: {} }),
      }),
  );

  assert.equal(responses.length, 1);
  assert.equal(responses[0].ok, false);
  assert.match(responses[0].error, /createGame requires payload.playerName/);
});

test("handler processes createGame end to end and broadcasts the new game", async () => {
  const responses = [];
  const broadcasts = [];
  let putGameCalls = 0;
  let putConnectionCalls = 0;

  const result = await withMocks(
    {
      sendSocketResponse: async (_domain, _stage, _connectionId, message) => {
        responses.push(message);
      },
      broadcastGameState: async (domainName, stage, gameId) => {
        broadcasts.push({ domainName, stage, gameId });
      },
      getGameById: async () => undefined,
      putConnection: async () => {
        putConnectionCalls += 1;
      },
      putGame: async () => {
        putGameCalls += 1;
      },
    },
    () =>
      handler({
        requestContext: { ...baseRequestContext, routeKey: "$default" },
        body: JSON.stringify({
          requestId: "req-3",
          action: "createGame",
          payload: { playerName: "Casey" },
        }),
      }),
  );

  assert.deepEqual(result, { statusCode: 200, body: "" });
  assert.equal(putGameCalls, 1);
  assert.equal(responses.length, 1);
  assert.equal(responses[0].ok, true);
  assert.equal(responses[0].result.game.players[0].name, "Casey");
  assert.equal(putConnectionCalls, 1);
  assert.equal(broadcasts.length, 1);
  assert.equal(broadcasts[0].gameId, responses[0].result.game.id);
  assert.equal(broadcasts[0].domainName, "domain.example");
  assert.equal(broadcasts[0].stage, "prod");
});
