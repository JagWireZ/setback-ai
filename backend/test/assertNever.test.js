const test = require("node:test");
const assert = require("node:assert/strict");

const { assertNever } = require("../dist/backend/engine/helpers/reducer/core/assertNever.js");

test("assertNever throws an error naming the unhandled value", () => {
  assert.throws(
    () => assertNever({ stage: "Unknown" }),
    (error) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, `Unhandled action: ${JSON.stringify({ stage: "Unknown" })}`);
      return true;
    },
  );
});

test("assertNever includes the JSON-stringified value in the message", () => {
  assert.throws(() => assertNever("weird-value"), /Unhandled action: "weird-value"/);
});
