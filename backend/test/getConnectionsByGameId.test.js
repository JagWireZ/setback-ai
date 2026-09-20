const test = require("node:test");
const assert = require("node:assert/strict");

const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
const {
  getConnectionsByGameId,
} = require("../dist/backend/engine/helpers/reducer/storage/getConnectionsByGameId.js");

const withEnv = async (value, fn) => {
  const original = process.env.DYNAMODB_TABLE_NAME;
  process.env.DYNAMODB_TABLE_NAME = value;
  try {
    return await fn();
  } finally {
    if (original === undefined) {
      delete process.env.DYNAMODB_TABLE_NAME;
    } else {
      process.env.DYNAMODB_TABLE_NAME = original;
    }
  }
};

const withSendMock = async (sendImpl, fn) => {
  const original = DynamoDBDocumentClient.prototype.send;
  DynamoDBDocumentClient.prototype.send = sendImpl;
  try {
    return await fn();
  } finally {
    DynamoDBDocumentClient.prototype.send = original;
  }
};

test("getConnectionsByGameId queries the gameId-entityType-index for connection items", async () => {
  const calls = [];
  const liveConnection = {
    id: "connection#conn-1",
    gameId: "game-1",
    entityType: "connection#conn-1",
    connectionId: "conn-1",
    playerToken: "token-1",
    expiresAt: Math.floor(Date.now() / 1000) + 1000,
  };

  const result = await withEnv("games-table", () =>
    withSendMock(
      async function mockSend(command) {
        calls.push(command);
        return { Items: [liveConnection] };
      },
      () => getConnectionsByGameId("game-1"),
    ),
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].constructor.name, "QueryCommand");
  assert.equal(calls[0].input.TableName, "games-table");
  assert.equal(calls[0].input.IndexName, "gameId-entityType-index");
  assert.equal(
    calls[0].input.KeyConditionExpression,
    "#gameId = :gameId AND begins_with(#entityType, :connectionPrefix)",
  );
  assert.deepEqual(calls[0].input.ExpressionAttributeNames, {
    "#gameId": "gameId",
    "#entityType": "entityType",
  });
  assert.deepEqual(calls[0].input.ExpressionAttributeValues, {
    ":gameId": "game-1",
    ":connectionPrefix": "connection#",
  });
  assert.deepEqual(result, [liveConnection]);
});

test("getConnectionsByGameId filters out expired connections", async () => {
  const liveConnection = {
    id: "connection#conn-1",
    gameId: "game-1",
    entityType: "connection#conn-1",
    connectionId: "conn-1",
    playerToken: "token-1",
    expiresAt: Math.floor(Date.now() / 1000) + 1000,
  };
  const expiredConnection = {
    id: "connection#conn-2",
    gameId: "game-1",
    entityType: "connection#conn-2",
    connectionId: "conn-2",
    playerToken: "token-2",
    expiresAt: Math.floor(Date.now() / 1000) - 1000,
  };

  const result = await withEnv("games-table", () =>
    withSendMock(
      async () => ({ Items: [liveConnection, expiredConnection] }),
      () => getConnectionsByGameId("game-1"),
    ),
  );

  assert.deepEqual(result, [liveConnection]);
});

test("getConnectionsByGameId pages through results using LastEvaluatedKey", async () => {
  const calls = [];
  const pageOne = {
    id: "connection#conn-1",
    gameId: "game-1",
    entityType: "connection#conn-1",
    connectionId: "conn-1",
    playerToken: "token-1",
    expiresAt: Math.floor(Date.now() / 1000) + 1000,
  };
  const pageTwo = {
    id: "connection#conn-2",
    gameId: "game-1",
    entityType: "connection#conn-2",
    connectionId: "conn-2",
    playerToken: "token-2",
    expiresAt: Math.floor(Date.now() / 1000) + 1000,
  };

  const result = await withEnv("games-table", () =>
    withSendMock(
      async function mockSend(command) {
        calls.push(command);
        if (calls.length === 1) {
          return { Items: [pageOne], LastEvaluatedKey: { id: "connection#conn-1" } };
        }
        return { Items: [pageTwo] };
      },
      () => getConnectionsByGameId("game-1"),
    ),
  );

  assert.equal(calls.length, 2);
  assert.equal(calls[0].input.ExclusiveStartKey, undefined);
  assert.deepEqual(calls[1].input.ExclusiveStartKey, { id: "connection#conn-1" });
  assert.deepEqual(result, [pageOne, pageTwo]);
});
