const test = require("node:test");
const assert = require("node:assert/strict");

const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
const {
  deleteGameById,
} = require("../dist/backend/engine/helpers/reducer/storage/deleteGameById.js");

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

test("deleteGameById transactionally deletes both the game item and its version item", async () => {
  const calls = [];

  await withEnv("games-table", () =>
    withSendMock(
      async function mockSend(command) {
        calls.push(command);
        return {};
      },
      () => deleteGameById("game-1"),
    ),
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].constructor.name, "TransactWriteCommand");
  assert.deepEqual(calls[0].input.TransactItems, [
    {
      Delete: {
        TableName: "games-table",
        Key: { id: "game-1" },
      },
    },
    {
      Delete: {
        TableName: "games-table",
        Key: { id: "game-1#version" },
      },
    },
  ]);
});
