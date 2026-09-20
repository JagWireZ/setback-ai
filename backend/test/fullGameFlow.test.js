const test = require("node:test");
const assert = require("node:assert/strict");

const { handler } = require("../dist/backend/src/handler.js");
const websocketModule = require("../dist/backend/src/websocket.js");
const getGameByIdModule = require("../dist/backend/engine/helpers/reducer/storage/getGameById.js");
const putGameModule = require("../dist/backend/engine/helpers/reducer/storage/putGame.js");
const putConnectionModule = require("../dist/backend/engine/helpers/reducer/storage/putConnection.js");
const turnTimingModule = require("../dist/backend/engine/helpers/reducer/gameState/turnTiming.js");
const reviewGameStateModule = require("../dist/backend/engine/ai/reviewGameState.js");

// This suite drives the real handler + reducer + AI-automation stack in-process, backed by
// an in-memory game store instead of DynamoDB/API Gateway, to exercise the full WebSocket
// handler contract for a complete game: create -> join -> deal -> bid -> play -> score -> complete.

const MODULES = {
  sendSocketResponse: websocketModule,
  broadcastGameState: websocketModule,
  getGameById: getGameByIdModule,
  putGame: putGameModule,
  putConnection: putConnectionModule,
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

const originalGetAutomationDueAt = turnTimingModule.getAutomationDueAt;

// AI/automation timing (turn delays, trick-reveal delay) is real-world-clock based so the UI
// can animate; collapsing any "due in the future" moment down to "due now" lets the AI runner
// finish a whole game synchronously instead of the test sleeping through real delays.
const fastGetAutomationDueAt = (game) => {
  const dueAt = originalGetAutomationDueAt(game);
  return typeof dueAt === "number" ? Date.now() : undefined;
};

const originalAdvanceDueAutomation = reviewGameStateModule.advanceDueAutomation;
const fastAdvanceDueAutomation = (game) => originalAdvanceDueAutomation(game, Number.POSITIVE_INFINITY);

const baseRequestContext = {
  domainName: "domain.example",
  stage: "prod",
};

test("full game flow: create -> join -> deal -> bid -> play tricks -> score -> complete", async () => {
  const games = new Map();
  const responses = [];

  const callAction = (connectionId, body) =>
    handler({
      requestContext: { ...baseRequestContext, connectionId, routeKey: "$default" },
      body: JSON.stringify(body),
    });

  const latestResponseFor = (requestId) => {
    const entry = [...responses].reverse().find((response) => response.message.requestId === requestId);
    assert.ok(entry, `expected a response for requestId ${requestId}`);
    return entry.message;
  };

  await withMocks(
    {
      getGameById: async (gameId) => games.get(gameId),
      putGame: async (game) => {
        games.set(game.id, game);
      },
      putConnection: async () => {},
      sendSocketResponse: async (_domainName, _stage, connectionId, message) => {
        responses.push({ connectionId, message });
      },
      broadcastGameState: async () => {},
      getAutomationDueAt: fastGetAutomationDueAt,
      advanceDueAutomation: fastAdvanceDueAutomation,
    },
    async () => {
      await callAction("conn-casey", {
        requestId: "create",
        action: "createGame",
        payload: { playerName: "Casey" },
      });
      const createResult = latestResponseFor("create");
      assert.equal(createResult.ok, true);

      const gameId = createResult.result.game.id;
      const caseyToken = createResult.result.playerToken;
      assert.equal(createResult.result.game.players.length, 5);
      assert.equal(createResult.result.game.phase.stage, "Lobby");

      await callAction("conn-riley", {
        requestId: "join",
        action: "joinGame",
        payload: { gameId, playerName: "Riley" },
      });
      const joinResult = latestResponseFor("join");
      assert.equal(joinResult.ok, true);

      const rileyToken = joinResult.result.playerToken;
      assert.notEqual(rileyToken, caseyToken);
      assert.equal(
        joinResult.result.game.players.filter((player) => player.type === "human").length,
        2,
      );

      const gameAfterJoin = games.get(gameId);
      const caseyPlayerId = gameAfterJoin.playerTokens.find((entry) => entry.token === caseyToken).playerId;
      const rileyPlayerId = gameAfterJoin.playerTokens.find((entry) => entry.token === rileyToken).playerId;

      await callAction("conn-casey", {
        requestId: "start",
        action: "startGame",
        payload: { gameId, playerToken: caseyToken, maxCards: 1 },
      });
      const startResult = latestResponseFor("start");
      assert.equal(startResult.ok, true);
      assert.equal(startResult.result.game.phase.stage, "Dealing");

      const gameAfterStart = games.get(gameId);
      assert.equal(gameAfterStart.phase.dealerPlayerId, caseyPlayerId);
      assert.equal(gameAfterStart.options.rounds.length, 1);

      await callAction("conn-casey", {
        requestId: "deal",
        action: "dealCards",
        payload: { gameId, playerToken: caseyToken },
      });
      const dealResult = latestResponseFor("deal");
      assert.equal(dealResult.ok, true);

      const gameAfterDeal = games.get(gameId);
      assert.equal(gameAfterDeal.phase.stage, "Bidding");
      assert.equal(gameAfterDeal.phase.turnPlayerId, rileyPlayerId);

      await callAction("conn-riley", {
        requestId: "bid-riley",
        action: "submitBid",
        payload: { gameId, playerToken: rileyToken, bid: 0 },
      });
      const rileyBidResult = latestResponseFor("bid-riley");
      assert.equal(rileyBidResult.ok, true);

      const gameAfterRileyBid = games.get(gameId);
      assert.equal(gameAfterRileyBid.phase.stage, "Bidding");
      assert.equal(gameAfterRileyBid.phase.turnPlayerId, caseyPlayerId);
      assert.equal(gameAfterRileyBid.phase.bids.length, 4, "the three AI seats should have auto-bid");

      await callAction("conn-casey", {
        requestId: "bid-casey",
        action: "submitBid",
        payload: { gameId, playerToken: caseyToken, bid: 0 },
      });
      const caseyBidResult = latestResponseFor("bid-casey");
      assert.equal(caseyBidResult.ok, true);

      let game = games.get(gameId);
      assert.equal(game.phase.stage, "Playing", "bidding should be complete after the dealer's bid");

      let playCount = 0;
      while (game.phase.stage === "Playing") {
        const turnPlayerId = game.phase.turnPlayerId;
        const isCasey = turnPlayerId === caseyPlayerId;
        const isRiley = turnPlayerId === rileyPlayerId;
        assert.ok(isCasey || isRiley, "AI automation should have already resolved any AI turn");

        const connectionId = isCasey ? "conn-casey" : "conn-riley";
        const playerToken = isCasey ? caseyToken : rileyToken;
        const hand = game.phase.cards.hands.find((entry) => entry.playerId === turnPlayerId);
        assert.ok(hand && hand.cards.length > 0, "acting player should hold a card to play");
        const card = hand.cards[0];

        playCount += 1;
        await callAction(connectionId, {
          requestId: `play-${playCount}`,
          action: "playCard",
          payload: { gameId, playerToken, card },
        });
        const playResult = latestResponseFor(`play-${playCount}`);
        assert.equal(playResult.ok, true);

        game = games.get(gameId);
      }

      assert.ok(playCount >= 1 && playCount <= 5, "each human should only need to be asked to play their own card(s)");
      assert.ok(
        game.phase.stage === "EndOfRound" || game.phase.stage === "GameOver",
        "the round should be complete once every player has played their card",
      );

      // Whichever player plays the final card of the round triggers the trick-reveal delay
      // (EndOfRound); if that was an AI player, AI automation may have already advanced all the
      // way to GameOver in the same afterResponse chain. In production the client polls via
      // checkState to advance past the reveal delay, so drive that same action here if needed.
      // drive that same action here instead of reaching into the reducer directly.
      let checkStateCount = 0;
      while (game.phase.stage !== "GameOver") {
        checkStateCount += 1;
        assert.ok(checkStateCount <= game.options.rounds.length + 1, "checkState should reach GameOver quickly");

        await callAction("conn-casey", {
          requestId: `check-${checkStateCount}`,
          action: "checkState",
          payload: { gameId, playerToken: caseyToken },
        });
        const checkResult = latestResponseFor(`check-${checkStateCount}`);
        assert.equal(checkResult.ok, true);

        game = games.get(gameId);
      }

      assert.equal(game.phase.stage, "GameOver");
      assert.equal(game.scores.length, 5);
      for (const score of game.scores) {
        assert.equal(score.rounds.length, 1);
        assert.equal(typeof score.total, "number");
      }
    },
  );
});
