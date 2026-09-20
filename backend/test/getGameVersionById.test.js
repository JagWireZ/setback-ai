const test = require("node:test");
const assert = require("node:assert/strict");

const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
const {
  getGameVersionById,
} = require("../dist/backend/engine/helpers/reducer/storage/getGameVersionById.js");

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

test("getGameVersionById fetches the version item by id", async () => {
  const calls = [];
  const item = {
    id: "game-1#version",
    gameId: "game-1",
    entityType: "version",
    version: 4,
    playerTokens: [{ playerId: "p1", token: "token-1" }],
    expiresAt: Math.floor(Date.now() / 1000) + 1000,
  };

  const result = await withEnv("games-table", () =>
    withSendMock(
      async function mockSend(command) {
        calls.push(command);
        return { Item: item };
      },
      () => getGameVersionById("game-1"),
    ),
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].constructor.name, "GetCommand");
  assert.equal(calls[0].input.TableName, "games-table");
  assert.deepEqual(calls[0].input.Key, { id: "game-1#version" });
  assert.deepEqual(result, item);
});

test("getGameVersionById returns undefined when no item is found", async () => {
  const result = await withEnv("games-table", () =>
    withSendMock(
      async () => ({}),
      () => getGameVersionById("game-1"),
    ),
  );

  assert.equal(result, undefined);
});

test("getGameVersionById returns undefined when the item has expired", async () => {
  const result = await withEnv("games-table", () =>
    withSendMock(
      async () => ({
        Item: {
          id: "game-1#version",
          expiresAt: Math.floor(Date.now() / 1000) - 10,
        },
      }),
      () => getGameVersionById("game-1"),
    ),
  );

  assert.equal(result, undefined);
});
