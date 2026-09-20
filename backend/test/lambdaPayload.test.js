const test = require("node:test");
const assert = require("node:assert/strict");

const { validateLambdaPayload } = require("../dist/backend/src/validation/lambdaPayload.js");

test("validateLambdaPayload accepts a well-formed createGame payload", () => {
  const event = {
    action: "createGame",
    payload: { playerName: "Casey" },
  };

  assert.equal(validateLambdaPayload(event), event);
});

test("validateLambdaPayload accepts createGame with an explicit blindBid flag", () => {
  const event = {
    action: "createGame",
    payload: { playerName: "Casey", blindBid: true },
  };

  assert.equal(validateLambdaPayload(event), event);
});

test("validateLambdaPayload rejects createGame with a missing playerName", () => {
  assert.throws(
    () =>
      validateLambdaPayload({
        action: "createGame",
        payload: {},
      }),
    /createGame requires payload.playerName/,
  );
});

test("validateLambdaPayload rejects createGame with a non-boolean blindBid", () => {
  assert.throws(
    () =>
      validateLambdaPayload({
        action: "createGame",
        payload: { playerName: "Casey", blindBid: "yes" },
      }),
    /blindBid must be a boolean/,
  );
});

test("validateLambdaPayload accepts a well-formed joinGame payload", () => {
  const event = {
    action: "joinGame",
    payload: { gameId: "game-1", playerName: "Casey" },
  };

  assert.equal(validateLambdaPayload(event), event);
});

test("validateLambdaPayload rejects joinGame with an empty gameId", () => {
  assert.throws(
    () =>
      validateLambdaPayload({
        action: "joinGame",
        payload: { gameId: "  ", playerName: "Casey" },
      }),
    /joinGame requires payload.gameId/,
  );
});

test("validateLambdaPayload accepts a well-formed playCard payload", () => {
  const event = {
    action: "playCard",
    payload: {
      gameId: "game-1",
      playerToken: "token-1",
      card: { rank: "A", suit: "Spades" },
    },
  };

  assert.equal(validateLambdaPayload(event), event);
});

test("validateLambdaPayload rejects playCard with a malformed card", () => {
  assert.throws(
    () =>
      validateLambdaPayload({
        action: "playCard",
        payload: {
          gameId: "game-1",
          playerToken: "token-1",
          card: { rank: "Z", suit: "Spades" },
        },
      }),
    /playCard requires payload.card with valid rank and suit/,
  );
});

test("validateLambdaPayload rejects playCard with a missing card", () => {
  assert.throws(
    () =>
      validateLambdaPayload({
        action: "playCard",
        payload: {
          gameId: "game-1",
          playerToken: "token-1",
        },
      }),
    /playCard requires payload.card/,
  );
});

test("validateLambdaPayload accepts a well-formed submitBid payload", () => {
  const event = {
    action: "submitBid",
    payload: { gameId: "game-1", playerToken: "token-1", bid: 3 },
  };

  assert.equal(validateLambdaPayload(event), event);
});

test("validateLambdaPayload rejects submitBid with a non-integer bid", () => {
  assert.throws(
    () =>
      validateLambdaPayload({
        action: "submitBid",
        payload: { gameId: "game-1", playerToken: "token-1", bid: "three" },
      }),
    /submitBid requires payload.bid/,
  );
});

test("validateLambdaPayload rejects submitBid with a non-boolean trip flag", () => {
  assert.throws(
    () =>
      validateLambdaPayload({
        action: "submitBid",
        payload: { gameId: "game-1", playerToken: "token-1", bid: 1, trip: "yes" },
      }),
    /trip must be a boolean/,
  );
});

test("validateLambdaPayload accepts a well-formed startGame payload", () => {
  const event = {
    action: "startGame",
    payload: { gameId: "game-1", playerToken: "token-1", maxCards: 6 },
  };

  assert.equal(validateLambdaPayload(event), event);
});

test("validateLambdaPayload rejects startGame with an out-of-range maxCards", () => {
  assert.throws(
    () =>
      validateLambdaPayload({
        action: "startGame",
        payload: { gameId: "game-1", playerToken: "token-1", maxCards: 20 },
      }),
    /startGame requires payload.maxCards \(1-10\)/,
  );
});

test("validateLambdaPayload rejects startGame with an invalid aiDifficulty", () => {
  assert.throws(
    () =>
      validateLambdaPayload({
        action: "startGame",
        payload: { gameId: "game-1", playerToken: "token-1", maxCards: 5, aiDifficulty: "extreme" },
      }),
    /aiDifficulty must be "easy", "medium", or "hard"/,
  );
});

test("validateLambdaPayload accepts a well-formed movePlayer payload", () => {
  const event = {
    action: "movePlayer",
    payload: { gameId: "game-1", playerToken: "token-1", playerId: "p1", direction: "left" },
  };

  assert.equal(validateLambdaPayload(event), event);
});

test("validateLambdaPayload rejects movePlayer with an invalid direction", () => {
  assert.throws(
    () =>
      validateLambdaPayload({
        action: "movePlayer",
        payload: { gameId: "game-1", playerToken: "token-1", playerId: "p1", direction: "up" },
      }),
    /movePlayer requires payload.direction as "left" or "right"/,
  );
});

test("validateLambdaPayload accepts a well-formed sortCards payload", () => {
  const event = {
    action: "sortCards",
    payload: { gameId: "game-1", playerToken: "token-1", mode: "bySuit" },
  };

  assert.equal(validateLambdaPayload(event), event);
});

test("validateLambdaPayload rejects sortCards with an invalid mode", () => {
  assert.throws(
    () =>
      validateLambdaPayload({
        action: "sortCards",
        payload: { gameId: "game-1", playerToken: "token-1", mode: "byColor" },
      }),
    /sortCards requires payload.mode as "bySuit" or "byRank"/,
  );
});

test("validateLambdaPayload accepts a well-formed sendReaction payload with an emoji", () => {
  const event = {
    action: "sendReaction",
    payload: { gameId: "game-1", playerToken: "token-1", emoji: "🎉" },
  };

  assert.equal(validateLambdaPayload(event), event);
});

test("validateLambdaPayload rejects sendReaction with both emoji and phrase", () => {
  assert.throws(
    () =>
      validateLambdaPayload({
        action: "sendReaction",
        payload: { gameId: "game-1", playerToken: "token-1", emoji: "🎉", phrase: "Well played." },
      }),
    /exactly one of payload.emoji or payload.phrase/,
  );
});

test("validateLambdaPayload rejects sendReaction with neither emoji nor phrase", () => {
  assert.throws(
    () =>
      validateLambdaPayload({
        action: "sendReaction",
        payload: { gameId: "game-1", playerToken: "token-1" },
      }),
    /exactly one of payload.emoji or payload.phrase/,
  );
});

test("validateLambdaPayload accepts a well-formed getGameState payload", () => {
  const event = {
    action: "getGameState",
    payload: { gameId: "game-1", playerToken: "token-1", version: 2 },
  };

  assert.equal(validateLambdaPayload(event), event);
});

test("validateLambdaPayload rejects getGameState with a non-integer version", () => {
  assert.throws(
    () =>
      validateLambdaPayload({
        action: "getGameState",
        payload: { gameId: "game-1", playerToken: "token-1", version: "2" },
      }),
    /getGameState requires payload.version/,
  );
});

test("validateLambdaPayload rejects a payload missing the required gameId across actions", () => {
  assert.throws(
    () =>
      validateLambdaPayload({
        action: "addSeat",
        payload: { playerToken: "token-1" },
      }),
    /addSeat requires payload.gameId/,
  );
});

test("validateLambdaPayload rejects an unrecognized action", () => {
  assert.throws(() =>
    validateLambdaPayload({
      action: "doSomethingUnknown",
      payload: {},
    }),
  );
});
