const test = require("node:test");
const assert = require("node:assert/strict");

const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
const {
  deleteConnectionById,
} = require("../dist/backend/engine/helpers/reducer/storage/deleteConnectionById.js");

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

test("deleteConnectionById deletes the connection item by its prefixed id", async () => {
  const calls = [];

  await withEnv("games-table", () =>
    withSendMock(
      async function mockSend(command) {
        calls.push(command);
        return {};
      },
      () => deleteConnectionById("conn-1"),
    ),
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].constructor.name, "DeleteCommand");
  assert.equal(calls[0].input.TableName, "games-table");
  assert.deepEqual(calls[0].input.Key, { id: "connection#conn-1" });
});
