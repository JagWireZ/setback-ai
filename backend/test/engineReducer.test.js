const test = require("node:test");
const assert = require("node:assert/strict");

const { engineReducer } = require("../dist/backend/engine/reducer.js");
const { createGame } = require("../dist/backend/engine/reducer/createGame.js");
const { joinGame } = require("../dist/backend/engine/reducer/joinGame.js");
const putGameModule = require("../dist/backend/engine/helpers/reducer/storage/putGame.js");
const getGameByIdModule = require("../dist/backend/engine/helpers/reducer/storage/getGameById.js");
const deleteGameByIdModule = require("../dist/backend/engine/helpers/reducer/storage/deleteGameById.js");
const getGameVersionByIdModule = require("../dist/backend/engine/helpers/reducer/storage/getGameVersionById.js");

const MODULES = {
  putGame: putGameModule,
  getGameById: getGameByIdModule,
  deleteGameById: deleteGameByIdModule,
  getGameVersionById: getGameVersionByIdModule,
};

const withMocks = async (mocks, fn) => {
  const originals = {};
  for (const [name, impl] of Object.entries(mocks)) {
    const targetModule = MODULES[name];
    originals[name] = targetModule[name];
    targetModule[name] = impl;
  }

  try {
    return await fn();
  } finally {
    for (const [name] of Object.entries(mocks)) {
      MODULES[name][name] = originals[name];
    }
  }
};

const noopPutGame = async () => {};

test("engineReducer routes createGame and persists the new game", async () => {
  let putGameCalls = 0;

  const result = await withMocks(
    {
      putGame: async () => {
        putGameCalls += 1;
      },
    },
    () =>
      engineReducer(undefined, {
        action: "createGame",
        payload: { playerName: "Casey" },
      }),
  );

  assert.equal(putGameCalls, 1);
  assert.equal(result.game.players[0].name, "Casey");
  assert.equal(typeof result.playerToken, "string");
  assert.equal(result.version, 1);
});

test("engineReducer rejects joinGame when no game is passed in", async () => {
  await withMocks({ putGame: noopPutGame }, () =>
    assert.rejects(
      () =>
        engineReducer(undefined, {
          action: "joinGame",
          payload: { gameId: "some-game", playerName: "Jordan" },
        }),
      /game not found/i,
    ),
  );
});

test("engineReducer routes joinGame against an existing game", async () => {
  const gameFixture = await buildFullLobbyGame();

  let putGameCalls = 0;
  const result = await withMocks(
    {
      putGame: async () => {
        putGameCalls += 1;
      },
    },
    () =>
      engineReducer(gameFixture, {
        action: "joinGame",
        payload: { gameId: gameFixture.id, playerName: "Jordan" },
      }),
  );

  assert.equal(putGameCalls, 1);
  assert.equal(result.game.players.find((player) => player.name === "Jordan").type, "human");
  assert.notEqual(result.playerToken, gameFixture.ownerToken);
});

// Full Game objects (including private fields like playerTokens/ownerToken) are what
// every reducer operates on; engineReducer itself is only ever handed this shape by
// its caller (see handler.js), so build fixtures via the real createGame reducer.
async function buildFullLobbyGame(playerName = "Casey") {
  const { game } = createGame({ action: "createGame", payload: { playerName } });
  return game;
}

test("engineReducer routes an owner action (addSeat) and requires the owner token", async () => {
  const gameFixture = await buildFullLobbyGame();

  let putGameCalls = 0;
  const result = await withMocks(
    {
      putGame: async () => {
        putGameCalls += 1;
      },
    },
    () =>
      engineReducer(gameFixture, {
        action: "addSeat",
        payload: { gameId: gameFixture.id, playerToken: gameFixture.ownerToken },
      }),
  );

  assert.equal(putGameCalls, 1);
  assert.equal(result.game.players.length, gameFixture.players.length + 1);
  assert.equal(result.version, gameFixture.version + 1);
});

test("engineReducer rejects an owner action from a non-owner token", async () => {
  const gameFixture = await buildFullLobbyGame();
  const nonOwnerToken = gameFixture.playerTokens.find(
    (entry) => entry.token !== gameFixture.ownerToken,
  ).token;

  await withMocks({ putGame: noopPutGame }, () =>
    assert.rejects(
      () =>
        engineReducer(gameFixture, {
          action: "addSeat",
          payload: { gameId: gameFixture.id, playerToken: nonOwnerToken },
        }),
      /owner token required/i,
    ),
  );
});

const buildBiddingGame = () => ({
  id: "game-1",
  version: 1,
  ownerToken: "owner-token",
  options: {
    maxCards: 5,
    blindBid: false,
    aiDifficulty: "medium",
    rounds: [{ cardCount: 5, direction: "up" }],
  },
  players: [
    { id: "p1", name: "Player 1", type: "human", connected: true },
    { id: "p2", name: "Player 2", type: "human", connected: true },
  ],
  playerTokens: [
    { playerId: "p1", token: "owner-token" },
    { playerId: "p2", token: "token-2" },
  ],
  playerOrder: ["p1", "p2"],
  scores: [
    { playerId: "p1", total: 0, possible: 0, rounds: [] },
    { playerId: "p2", total: 0, possible: 0, rounds: [] },
  ],
  phase: {
    stage: "Bidding",
    dealerPlayerId: "p2",
    roundIndex: 0,
    trickIndex: 0,
    turnPlayerId: "p1",
    bids: [],
    cards: {
      deck: [],
      trump: { rank: "A", suit: "Spades" },
      trumpBroken: false,
      hands: [
        { playerId: "p1", cards: [{ rank: "9", suit: "Hearts" }] },
        { playerId: "p2", cards: [{ rank: "K", suit: "Hearts" }] },
      ],
      currentTrick: undefined,
      completedTricks: [],
    },
  },
});

test("engineReducer routes a player action (submitBid) for a valid player token", async () => {
  const gameFixture = buildBiddingGame();

  let putGameCalls = 0;
  const result = await withMocks(
    {
      putGame: async () => {
        putGameCalls += 1;
      },
    },
    () =>
      engineReducer(gameFixture, {
        action: "submitBid",
        payload: { gameId: "game-1", playerToken: "owner-token", bid: 2 },
      }),
  );

  assert.equal(putGameCalls, 1);
  // submitBid bumps the version itself, and the reducer's player-action wrapper
  // also touches the acting player's presence, which can bump it again.
  assert.ok(result.version > gameFixture.version);
  assert.equal(result.playerToken, undefined);
});

test("engineReducer rejects a player action for an invalid player token", async () => {
  const gameFixture = buildBiddingGame();

  await withMocks({ putGame: noopPutGame }, () =>
    assert.rejects(
      () =>
        engineReducer(gameFixture, {
          action: "submitBid",
          payload: { gameId: "game-1", playerToken: "stale-token", bid: 2 },
        }),
      /invalid player token/i,
    ),
  );
});

test("engineReducer routes checkState without persisting when nothing changed", async () => {
  const gameFixture = await buildFullLobbyGame();

  const result = await withMocks(
    {
      putGame: async () => {
        throw new Error("putGame should not be called when state is unchanged");
      },
    },
    () =>
      engineReducer(gameFixture, {
        action: "checkState",
        payload: { gameId: gameFixture.id, playerToken: gameFixture.ownerToken },
      }),
  );

  assert.equal(result.version, gameFixture.version);
});

test("engineReducer rejects checkState from a non-owner token", async () => {
  const gameFixture = await buildFullLobbyGame();
  const nonOwnerToken = gameFixture.playerTokens.find(
    (entry) => entry.token !== gameFixture.ownerToken,
  ).token;

  await assert.rejects(
    () =>
      engineReducer(gameFixture, {
        action: "checkState",
        payload: { gameId: gameFixture.id, playerToken: nonOwnerToken },
      }),
    /owner token required/i,
  );
});

test("engineReducer routes removePlayer as an owner-initiated removal", async () => {
  const owned = await buildFullLobbyGame();
  const joined = joinGame(owned, {
    action: "joinGame",
    payload: { gameId: owned.id, playerName: "Jordan" },
  });
  const gameFixture = joined.game;
  const jordan = gameFixture.players.find((player) => player.name === "Jordan");

  let putGameCalls = 0;
  const result = await withMocks(
    {
      putGame: async () => {
        putGameCalls += 1;
      },
    },
    () =>
      engineReducer(gameFixture, {
        action: "removePlayer",
        payload: {
          gameId: gameFixture.id,
          playerToken: gameFixture.ownerToken,
          playerId: jordan.id,
        },
      }),
  );

  assert.equal(putGameCalls, 1);
  assert.equal(result.game.players.find((player) => player.id === jordan.id).type, "ai");
});

test("engineReducer routes removePlayer as a self-removal", async () => {
  const owned = await buildFullLobbyGame();
  const joined = joinGame(owned, {
    action: "joinGame",
    payload: { gameId: owned.id, playerName: "Jordan" },
  });
  const gameFixture = joined.game;
  const jordan = gameFixture.players.find((player) => player.name === "Jordan");

  const result = await withMocks({ putGame: noopPutGame }, () =>
    engineReducer(gameFixture, {
      action: "removePlayer",
      payload: {
        gameId: gameFixture.id,
        playerToken: joined.playerToken,
        playerId: jordan.id,
      },
    }),
  );

  assert.equal(result.game.players.find((player) => player.id === jordan.id).type, "ai");
});

test("engineReducer rejects removePlayer when neither owner nor self", async () => {
  const owned = await buildFullLobbyGame();
  const joined = joinGame(owned, {
    action: "joinGame",
    payload: { gameId: owned.id, playerName: "Jordan" },
  });
  const gameFixture = joined.game;
  const aiPlayer = gameFixture.players.find((player) => player.type === "ai");

  await assert.rejects(
    () =>
      engineReducer(gameFixture, {
        action: "removePlayer",
        payload: {
          gameId: gameFixture.id,
          playerToken: joined.playerToken,
          playerId: aiPlayer.id,
        },
      }),
    /only the owner can remove other players/i,
  );
});

test("engineReducer routes removeGame by loading the game from storage", async () => {
  const gameFixture = await buildFullLobbyGame();
  let deleteCalledWith;

  const result = await withMocks(
    {
      getGameById: async () => gameFixture,
      deleteGameById: async (gameId) => {
        deleteCalledWith = gameId;
      },
    },
    () =>
      engineReducer(undefined, {
        action: "removeGame",
        payload: { gameId: gameFixture.id, playerToken: gameFixture.ownerToken },
      }),
  );

  assert.deepEqual(result, {});
  assert.equal(deleteCalledWith, gameFixture.id);
});

test("engineReducer rejects removeGame when the game cannot be found", async () => {
  await withMocks({ getGameById: async () => undefined }, () =>
    assert.rejects(
      () =>
        engineReducer(undefined, {
          action: "removeGame",
          payload: { gameId: "missing-game", playerToken: "some-token" },
        }),
      /game not found/i,
    ),
  );
});

test("engineReducer rejects removeGame from a non-owner token", async () => {
  const gameFixture = await buildFullLobbyGame();

  await withMocks({ getGameById: async () => gameFixture }, () =>
    assert.rejects(
      () =>
        engineReducer(undefined, {
          action: "removeGame",
          payload: { gameId: gameFixture.id, playerToken: "not-the-owner" },
        }),
      /owner token required/i,
    ),
  );
});

test("engineReducer routes getGameState by loading the game and version from storage", async () => {
  const gameFixture = await buildFullLobbyGame();

  const result = await withMocks(
    {
      getGameVersionById: async () => undefined,
      getGameById: async () => gameFixture,
      putGame: noopPutGame,
    },
    () =>
      engineReducer(undefined, {
        action: "getGameState",
        payload: {
          gameId: gameFixture.id,
          playerToken: gameFixture.ownerToken,
          version: 0,
        },
      }),
  );

  assert.equal(result.game.id, gameFixture.id);
  assert.equal(result.version, gameFixture.version);
});

test("engineReducer rejects getGameState for an invalid player token", async () => {
  const gameFixture = await buildFullLobbyGame();

  await withMocks(
    {
      getGameVersionById: async () => undefined,
      getGameById: async () => gameFixture,
    },
    () =>
      assert.rejects(
        () =>
          engineReducer(undefined, {
            action: "getGameState",
            payload: {
              gameId: gameFixture.id,
              playerToken: "not-a-real-token",
              version: 0,
            },
          }),
        /invalid player token/i,
      ),
  );
});

test("engineReducer rejects an unrecognized action", async () => {
  await assert.rejects(
    () =>
      engineReducer(undefined, {
        action: "notARealAction",
        payload: {},
      }),
    /unhandled action/i,
  );
});
