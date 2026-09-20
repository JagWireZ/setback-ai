const test = require("node:test");
const assert = require("node:assert/strict");

const { tableName } = require("../dist/backend/engine/helpers/reducer/storage/tableName.js");

const withEnv = (value, fn) => {
  const original = process.env.DYNAMODB_TABLE_NAME;
  if (value === undefined) {
    delete process.env.DYNAMODB_TABLE_NAME;
  } else {
    process.env.DYNAMODB_TABLE_NAME = value;
  }

  try {
    return fn();
  } finally {
    if (original === undefined) {
      delete process.env.DYNAMODB_TABLE_NAME;
    } else {
      process.env.DYNAMODB_TABLE_NAME = original;
    }
  }
};

test("tableName returns the DYNAMODB_TABLE_NAME environment variable", () => {
  withEnv("my-table", () => {
    assert.equal(tableName(), "my-table");
  });
});

test("tableName throws when DYNAMODB_TABLE_NAME is missing", () => {
  withEnv(undefined, () => {
    assert.throws(() => tableName(), /Missing DYNAMODB_TABLE_NAME/);
  });
});

test("tableName throws when DYNAMODB_TABLE_NAME is empty", () => {
  withEnv("", () => {
    assert.throws(() => tableName(), /Missing DYNAMODB_TABLE_NAME/);
  });
});
