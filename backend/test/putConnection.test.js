const test = require("node:test");
const assert = require("node:assert/strict");

const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
const {
  putConnection,
} = require("../dist/backend/engine/helpers/reducer/storage/putConnection.js");

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

test("putConnection stores a connection item keyed by the normalized game id", async () => {
  const calls = [];

  await withEnv("games-table", () =>
    withSendMock(
      async function mockSend(command) {
        calls.push(command);
        return {};
      },
      () => putConnection("conn-1", "  Game-1  ", "token-1"),
    ),
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].constructor.name, "PutCommand");
  assert.equal(calls[0].input.TableName, "games-table");
  assert.equal(calls[0].input.Item.id, "connection#conn-1");
  assert.equal(calls[0].input.Item.gameId, "game-1");
  assert.equal(calls[0].input.Item.entityType, "connection#conn-1");
  assert.equal(calls[0].input.Item.connectionId, "conn-1");
  assert.equal(calls[0].input.Item.playerToken, "token-1");
  assert.equal(typeof calls[0].input.Item.expiresAt, "number");
});
