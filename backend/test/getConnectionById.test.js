const test = require("node:test");
const assert = require("node:assert/strict");

const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
const {
  getConnectionById,
} = require("../dist/backend/engine/helpers/reducer/storage/getConnectionById.js");

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

test("getConnectionById fetches the connection item by id", async () => {
  const calls = [];
  const item = {
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
        return { Item: item };
      },
      () => getConnectionById("conn-1"),
    ),
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].constructor.name, "GetCommand");
  assert.equal(calls[0].input.TableName, "games-table");
  assert.deepEqual(calls[0].input.Key, { id: "connection#conn-1" });
  assert.deepEqual(result, item);
});

test("getConnectionById returns undefined when no item is found", async () => {
  const result = await withEnv("games-table", () =>
    withSendMock(
      async () => ({}),
      () => getConnectionById("conn-1"),
    ),
  );

  assert.equal(result, undefined);
});

test("getConnectionById returns undefined when the connection has expired", async () => {
  const result = await withEnv("games-table", () =>
    withSendMock(
      async () => ({
        Item: {
          id: "connection#conn-1",
          expiresAt: Math.floor(Date.now() / 1000) - 10,
        },
      }),
      () => getConnectionById("conn-1"),
    ),
  );

  assert.equal(result, undefined);
});
