const test = require("node:test");
const assert = require("node:assert/strict");

const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
const { getGameById } = require("../dist/backend/engine/helpers/reducer/storage/getGameById.js");

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

test("getGameById fetches by the normalized game id and strips storage-only fields", async () => {
  const calls = [];

  const game = await withEnv("games-table", () =>
    withSendMock(
      async function mockSend(command) {
        calls.push(command);
        return {
          Item: {
            id: "game-1",
            gameId: "game-1",
            entityType: "game",
            expiresAt: Math.floor(Date.now() / 1000) + 1000,
            version: 1,
            players: [],
          },
        };
      },
      () => getGameById("  Game-1  "),
    ),
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].constructor.name, "GetCommand");
  assert.equal(calls[0].input.TableName, "games-table");
  assert.deepEqual(calls[0].input.Key, { id: "game-1" });

  assert.deepEqual(game, { id: "game-1", version: 1, players: [] });
});

test("getGameById returns undefined when no item is found", async () => {
  const game = await withEnv("games-table", () =>
    withSendMock(
      async () => ({}),
      () => getGameById("game-1"),
    ),
  );

  assert.equal(game, undefined);
});

test("getGameById returns undefined when the stored item has expired", async () => {
  const game = await withEnv("games-table", () =>
    withSendMock(
      async () => ({
        Item: {
          id: "game-1",
          expiresAt: Math.floor(Date.now() / 1000) - 10,
          version: 1,
        },
      }),
      () => getGameById("game-1"),
    ),
  );

  assert.equal(game, undefined);
});
