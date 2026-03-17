const test = require("node:test");
const assert = require("node:assert/strict");

const { createGame } = require("../dist/backend/engine/reducer/createGame.js");
const { removePlayer } = require("../dist/backend/engine/reducer/removePlayer.js");
const { BOT_NAMES } = require("../dist/backend/engine/helpers/reducer/player/getBotName.js");
const { reviewGameState } = require("../dist/backend/engine/ai/reviewGameState.js");

test("createGame assigns bot names from the curated pool", () => {
  const result = createGame({
    action: "createGame",
    payload: {
      playerName: "Casey",
    },
  });

  const aiPlayers = result.game.players.filter((player) => player.type === "ai");
  const aiNames = aiPlayers.map((player) => player.name);

  assert.equal(aiPlayers.length, 4);
  assert.ok(aiPlayers.every((player) => BOT_NAMES.includes(player.name)));
  assert.equal(new Set(aiNames).size, aiNames.length);
  assert.ok(aiNames.every((name) => name !== "Casey"));
  assert.equal(result.game.options.maxCards, 10);
  assert.equal(result.game.options.aiDifficulty, "medium");
  assert.deepEqual(result.game.options.rounds, []);
});

test("removePlayer replaces a human with an available curated bot name", () => {
  const removedPlayerToken = "token-3";
  const updated = removePlayer(
    {
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
        { id: "p1", name: "Casey", type: "human", connected: true },
        { id: "p2", name: "Sharp Shuffle", type: "ai", connected: true },
        { id: "p3", name: "Robin", type: "human", connected: true },
      ],
      playerTokens: [
        { playerId: "p1", token: "owner-token" },
        { playerId: "p2", token: "token-2" },
        { playerId: "p3", token: removedPlayerToken },
      ],
      playerOrder: ["p1", "p2", "p3"],
      scores: [],
      reactions: [],
      phase: { stage: "Lobby" },
    },
    {
      action: "removePlayer",
      payload: {
        gameId: "game-1",
        playerId: "p3",
      },
    },
  );

  const replacement = updated.players.find((player) => player.id === "p3");

  assert.equal(replacement.type, "ai");
  assert.equal(replacement.connected, true);
  assert.ok(BOT_NAMES.includes(replacement.name));
  assert.notEqual(replacement.name, "Sharp Shuffle");
  assert.notEqual(replacement.name, "Casey");
  assert.notEqual(replacement.name, "Robin");
  assert.notEqual(
    updated.playerTokens.find((playerToken) => playerToken.playerId === "p3").token,
    removedPlayerToken,
  );
});

test("removePlayer allows the converted AI to act immediately when it is their turn", () => {
  const updated = removePlayer(
    {
      id: "game-1",
      version: 1,
      ownerToken: "owner-token",
      options: {
        maxCards: 1,
        blindBid: false,
        aiDifficulty: "medium",
        rounds: [{ cardCount: 1, direction: "up" }],
      },
      players: [
        { id: "p1", name: "Casey", type: "human", connected: true },
        { id: "p2", name: "Robin", type: "human", connected: true },
        { id: "p3", name: "Jordan", type: "human", connected: true },
      ],
      playerTokens: [
        { playerId: "p1", token: "owner-token" },
        { playerId: "p2", token: "token-2" },
        { playerId: "p3", token: "token-3" },
      ],
      playerOrder: ["p1", "p2", "p3"],
      scores: [
        { playerId: "p1", total: 0, possible: 0, rounds: [] },
        { playerId: "p2", total: 0, possible: 0, rounds: [] },
        { playerId: "p3", total: 0, possible: 0, rounds: [] },
      ],
      reactions: [],
      phase: {
        stage: "Playing",
        dealerPlayerId: "p1",
        roundIndex: 0,
        trickIndex: 0,
        turnPlayerId: "p2",
        bids: [
          { playerId: "p1", amount: 1, trip: false },
          { playerId: "p2", amount: 1, trip: false },
          { playerId: "p3", amount: 0, trip: false },
        ],
        cards: {
          deck: [],
          trump: { rank: "2", suit: "Spades" },
          trumpBroken: true,
          hands: [
            { playerId: "p1", cards: [{ rank: "A", suit: "Clubs" }] },
            { playerId: "p2", cards: [{ rank: "K", suit: "Clubs" }] },
            { playerId: "p3", cards: [{ rank: "Q", suit: "Clubs" }] },
          ],
          currentTrick: {
            index: 0,
            leadPlayerId: "p1",
            plays: [{ playerId: "p1", card: { rank: "A", suit: "Clubs" } }],
          },
          completedTricks: [],
        },
      },
    },
    {
      action: "removePlayer",
      payload: {
        gameId: "game-1",
        playerId: "p2",
      },
    },
  );

  assert.equal(updated.phase.turnPlayerId, "p2");
  assert.equal(updated.players.find((player) => player.id === "p2").type, "ai");

  const automated = reviewGameState(updated);

  assert.equal(automated.phase.stage, "Playing");
  assert.deepEqual(automated.phase.cards.currentTrick.plays[1], {
    playerId: "p2",
    card: { rank: "K", suit: "Clubs" },
  });
  assert.equal(automated.phase.turnPlayerId, "p3");
});
