const test = require("node:test");
const assert = require("node:assert/strict");

const { withNextVersion } = require("../dist/backend/engine/helpers/reducer/gameState/withNextVersion.js");

test("withNextVersion increments the version and merges the patch", () => {
  const game = { id: "game-1", version: 3, players: [{ id: "p1" }] };

  const updated = withNextVersion(game, { players: [{ id: "p2" }] });

  assert.equal(updated.version, 4);
  assert.deepEqual(updated.players, [{ id: "p2" }]);
  assert.equal(updated.id, "game-1");
});

test("withNextVersion does not mutate the original game", () => {
  const game = { id: "game-1", version: 1 };

  const updated = withNextVersion(game, {});

  assert.equal(game.version, 1);
  assert.equal(updated.version, 2);
  assert.notEqual(updated, game);
});

test("withNextVersion applies an empty patch while still bumping the version", () => {
  const game = { id: "game-1", version: 0, foo: "bar" };

  const updated = withNextVersion(game, {});

  assert.equal(updated.version, 1);
  assert.equal(updated.foo, "bar");
});
