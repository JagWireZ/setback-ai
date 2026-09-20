const test = require("node:test");
const assert = require("node:assert/strict");

const { toResult } = require("../dist/backend/engine/helpers/reducer/gameState/toResult.js");

const baseGame = () => ({
  id: "game-1",
  version: 7,
  ownerToken: "owner-token",
  options: { maxCards: 5, blindBid: false, aiDifficulty: "medium", rounds: [] },
  players: [{ id: "p1", name: "Player 1", type: "human", connected: true }],
  playerTokens: [{ playerId: "p1", token: "token-1" }],
  playerOrder: ["p1"],
  scores: [],
  reactions: [],
  phase: { stage: "Lobby" },
});

test("toResult includes the game version and playerToken", () => {
  const result = toResult(baseGame(), "token-1");

  assert.equal(result.version, 7);
  assert.equal(result.playerToken, "token-1");
  assert.ok(result.game);
});

test("toResult omits playerToken when not provided", () => {
  const result = toResult(baseGame());

  assert.equal(result.playerToken, undefined);
});

test("toResult uses playerToken as the viewer when no viewerPlayerToken is given", () => {
  const game = baseGame();
  game.phase = {
    stage: "Playing",
    dealerPlayerId: "p1",
    roundIndex: 0,
    trickIndex: 0,
    turnPlayerId: "p1",
    bids: [],
    cards: {
      deck: [],
      trumpBroken: false,
      hands: [{ playerId: "p1", cards: [{ rank: "A", suit: "Clubs" }] }],
      completedTricks: [],
    },
  };

  const result = toResult(game, "token-1");

  assert.deepEqual(result.game.phase.cards.hands, [
    { playerId: "p1", cards: [{ rank: "A", suit: "Clubs" }] },
  ]);
});

test("toResult prefers viewerPlayerToken over playerToken for determining visibility", () => {
  const game = baseGame();
  game.players.push({ id: "p2", name: "Player 2", type: "human", connected: true });
  game.playerTokens.push({ playerId: "p2", token: "token-2" });
  game.phase = {
    stage: "Playing",
    dealerPlayerId: "p1",
    roundIndex: 0,
    trickIndex: 0,
    turnPlayerId: "p1",
    bids: [],
    cards: {
      deck: [],
      trumpBroken: false,
      hands: [
        { playerId: "p1", cards: [{ rank: "A", suit: "Clubs" }] },
        { playerId: "p2", cards: [{ rank: "2", suit: "Clubs" }] },
      ],
      completedTricks: [],
    },
  };

  const result = toResult(game, "token-1", "token-2");

  assert.deepEqual(result.game.phase.cards.hands, [
    { playerId: "p2", cards: [{ rank: "2", suit: "Clubs" }] },
  ]);
  assert.equal(result.playerToken, "token-1");
});
