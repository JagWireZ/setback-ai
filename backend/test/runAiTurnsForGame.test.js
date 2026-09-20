const test = require("node:test");
const assert = require("node:assert/strict");

const { runAiTurnsForGame } = require("../dist/backend/engine/ai/runAiTurnsForGame.js");
const getGameByIdModule = require("../dist/backend/engine/helpers/reducer/storage/getGameById.js");
const putGameModule = require("../dist/backend/engine/helpers/reducer/storage/putGame.js");
const turnTimingModule = require("../dist/backend/engine/helpers/reducer/gameState/turnTiming.js");
const reviewGameStateModule = require("../dist/backend/engine/ai/reviewGameState.js");

const MODULES = {
  getGameById: getGameByIdModule,
  putGame: putGameModule,
  normalizeTurnDueAt: turnTimingModule,
  setCurrentTurnDueAt: turnTimingModule,
  getAutomationDueAt: turnTimingModule,
  advanceDueAutomation: reviewGameStateModule,
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

const identity = (game) => game;

test("runAiTurnsForGame returns undefined when the game does not exist", async () => {
  const result = await withMocks(
    {
      getGameById: async () => undefined,
    },
    () => runAiTurnsForGame("game-1"),
  );

  assert.equal(result, undefined);
});

test("runAiTurnsForGame returns the game unchanged when no automation is due", async () => {
  const game = { id: "game-1", version: 1 };
  let putGameCalls = 0;

  const result = await withMocks(
    {
      getGameById: async () => game,
      normalizeTurnDueAt: identity,
      getAutomationDueAt: () => undefined,
      putGame: async () => {
        putGameCalls += 1;
      },
    },
    () => runAiTurnsForGame("game-1"),
  );

  assert.equal(result, game);
  assert.equal(putGameCalls, 0);
});

test("runAiTurnsForGame persists a normalized game before checking whether automation is due", async () => {
  const game = { id: "game-1", version: 1 };
  const normalizedGame = { id: "game-1", version: 1, normalized: true };
  const putCalls = [];

  const result = await withMocks(
    {
      getGameById: async () => game,
      normalizeTurnDueAt: (input) => (input === game ? normalizedGame : input),
      getAutomationDueAt: (input) => {
        assert.equal(input, normalizedGame);
        return undefined;
      },
      putGame: async (input) => {
        putCalls.push(input);
      },
    },
    () => runAiTurnsForGame("game-1"),
  );

  assert.equal(result, normalizedGame);
  assert.deepEqual(putCalls, [normalizedGame]);
});

test("runAiTurnsForGame applies initialDelayMs by overriding the turn due time before the first check", async () => {
  const game = { id: "game-1", version: 1 };
  const overriddenGame = { id: "game-1", version: 1, overridden: true };
  const putCalls = [];
  const setCurrentTurnDueAtCalls = [];

  const result = await withMocks(
    {
      getGameById: async () => game,
      normalizeTurnDueAt: identity,
      setCurrentTurnDueAt: (input, dueAt) => {
        setCurrentTurnDueAtCalls.push({ input, dueAt });
        return overriddenGame;
      },
      getAutomationDueAt: (input) => {
        assert.equal(input, overriddenGame);
        return undefined;
      },
      putGame: async (input) => {
        putCalls.push(input);
      },
    },
    () => runAiTurnsForGame("game-1", { initialDelayMs: 5000 }),
  );

  assert.equal(result, overriddenGame);
  assert.deepEqual(putCalls, [overriddenGame]);
  assert.equal(setCurrentTurnDueAtCalls.length, 1);
  assert.equal(setCurrentTurnDueAtCalls[0].input, game);
});

test("runAiTurnsForGame only applies initialDelayMs once even across multiple steps", async () => {
  const gameStepOne = { id: "game-1", version: 1 };
  const gameStepTwo = { id: "game-1", version: 2 };
  const overriddenGame = { id: "game-1", version: 1, overridden: true };
  let getGameByIdCalls = 0;
  let setCurrentTurnDueAtCalls = 0;

  const result = await withMocks(
    {
      getGameById: async () => {
        getGameByIdCalls += 1;
        // Calls: 1) initial fetch, 2) refetch after wait, 3) next step's initial fetch.
        if (getGameByIdCalls <= 2) {
          return gameStepOne;
        }
        return gameStepTwo;
      },
      normalizeTurnDueAt: identity,
      setCurrentTurnDueAt: (input) => {
        setCurrentTurnDueAtCalls += 1;
        return overriddenGame;
      },
      getAutomationDueAt: (input) => {
        if (input === gameStepTwo) {
          return undefined;
        }
        return Date.now();
      },
      advanceDueAutomation: () => gameStepTwo,
      putGame: async () => {},
    },
    () => runAiTurnsForGame("game-1", { initialDelayMs: 1000 }),
  );

  assert.equal(result, gameStepTwo);
  assert.equal(setCurrentTurnDueAtCalls, 1);
});

test("runAiTurnsForGame waits for the due time, advances one step, and reports it via onStep", async () => {
  const game = { id: "game-1", version: 1 };
  const updatedGame = { id: "game-1", version: 2 };
  const putCalls = [];
  const onStepCalls = [];
  let getGameByIdCalls = 0;

  const result = await withMocks(
    {
      getGameById: async () => {
        getGameByIdCalls += 1;
        return getGameByIdCalls <= 2 ? game : updatedGame;
      },
      normalizeTurnDueAt: identity,
      getAutomationDueAt: (input) => (input === updatedGame ? undefined : Date.now()),
      advanceDueAutomation: (input) => {
        assert.equal(input, game);
        return updatedGame;
      },
      putGame: async (input) => {
        putCalls.push(input);
      },
    },
    () =>
      runAiTurnsForGame("game-1", {
        onStep: (input) => {
          onStepCalls.push(input);
        },
      }),
  );

  assert.equal(result, updatedGame);
  assert.deepEqual(putCalls, [updatedGame]);
  assert.deepEqual(onStepCalls, [updatedGame]);
});

test("runAiTurnsForGame returns undefined if the game disappears while waiting for the due time", async () => {
  const game = { id: "game-1", version: 1 };
  let getGameByIdCalls = 0;
  let advanceDueAutomationCalls = 0;

  const result = await withMocks(
    {
      getGameById: async () => {
        getGameByIdCalls += 1;
        return getGameByIdCalls === 1 ? game : undefined;
      },
      normalizeTurnDueAt: identity,
      getAutomationDueAt: () => Date.now(),
      advanceDueAutomation: () => {
        advanceDueAutomationCalls += 1;
        return undefined;
      },
      putGame: async () => {},
    },
    () => runAiTurnsForGame("game-1"),
  );

  assert.equal(result, undefined);
  assert.equal(advanceDueAutomationCalls, 0);
});

test("runAiTurnsForGame returns the refreshed game when nothing is left to automate after waiting", async () => {
  const game = { id: "game-1", version: 1 };

  const result = await withMocks(
    {
      getGameById: async () => game,
      normalizeTurnDueAt: identity,
      getAutomationDueAt: () => Date.now(),
      advanceDueAutomation: () => undefined,
      putGame: async () => {
        throw new Error("putGame should not be called when nothing is automated");
      },
    },
    () => runAiTurnsForGame("game-1"),
  );

  assert.equal(result, game);
});

test("runAiTurnsForGame throws once it exceeds the maximum number of automation steps", async () => {
  const baseGame = { id: "game-1", version: 0 };
  let version = 0;

  await assert.rejects(
    () =>
      withMocks(
        {
          getGameById: async () => baseGame,
          normalizeTurnDueAt: identity,
          getAutomationDueAt: () => Date.now(),
          advanceDueAutomation: () => {
            version += 1;
            return { id: "game-1", version };
          },
          putGame: async () => {},
        },
        () => runAiTurnsForGame("game-1"),
      ),
    /AI turn runner exceeded step limit/,
  );
});
