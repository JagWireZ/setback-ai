const test = require("node:test");
const assert = require("node:assert/strict");

const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
const { putGame } = require("../dist/backend/engine/helpers/reducer/storage/putGame.js");

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

test("putGame transactionally writes the game item and its version item", async () => {
  const calls = [];
  const game = {
    id: "game-1",
    version: 2,
    ownerToken: "owner-token",
    playerTokens: [{ playerId: "p1", token: "token-1" }],
    players: [],
  };

  await withEnv("games-table", () =>
    withSendMock(
      async function mockSend(command) {
        calls.push(command);
        return {};
      },
      () => putGame(game),
    ),
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].constructor.name, "TransactWriteCommand");

  const [gamePut, versionPut] = calls[0].input.TransactItems;

  assert.equal(gamePut.Put.TableName, "games-table");
  assert.equal(gamePut.Put.Item.id, "game-1");
  assert.equal(gamePut.Put.Item.gameId, "game-1");
  assert.equal(gamePut.Put.Item.entityType, "game");
  assert.equal(gamePut.Put.Item.version, 2);
  assert.equal(typeof gamePut.Put.Item.expiresAt, "number");

  assert.equal(versionPut.Put.TableName, "games-table");
  assert.equal(versionPut.Put.Item.id, "game-1#version");
  assert.equal(versionPut.Put.Item.gameId, "game-1");
  assert.equal(versionPut.Put.Item.entityType, "version");
  assert.equal(versionPut.Put.Item.version, 2);
  assert.deepEqual(versionPut.Put.Item.playerTokens, game.playerTokens);
  assert.equal(typeof versionPut.Put.Item.expiresAt, "number");
});
