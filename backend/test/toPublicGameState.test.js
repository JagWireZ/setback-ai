const test = require("node:test");
const assert = require("node:assert/strict");

const { toPublicGameState } = require("../dist/backend/engine/helpers/reducer/gameState/toPublicGameState.js");

const baseGame = () => ({
  id: "game-1",
  version: 2,
  ownerToken: "owner-token",
  options: { maxCards: 5, blindBid: false, aiDifficulty: "medium", rounds: [] },
  players: [
    { id: "p1", name: "Player 1", type: "human", connected: true },
    { id: "p2", name: "Player 2", type: "human", connected: true },
  ],
  playerTokens: [
    { playerId: "p1", token: "token-1" },
    { playerId: "p2", token: "token-2" },
  ],
  playerOrder: ["p1", "p2"],
  scores: [],
  reactions: [{ id: "r1", playerId: "p1", createdAt: Date.now() }],
  phase: {
    stage: "Playing",
    dealerPlayerId: "p1",
    roundIndex: 0,
    trickIndex: 0,
    turnPlayerId: "p1",
    bids: [],
    cards: {
      deck: [{ rank: "A", suit: "Clubs" }, { rank: "2", suit: "Clubs" }],
      trump: undefined,
      trumpBroken: false,
      hands: [
        { playerId: "p1", cards: [{ rank: "K", suit: "Hearts" }] },
        { playerId: "p2", cards: [{ rank: "Q", suit: "Hearts" }] },
      ],
      completedTricks: [],
    },
  },
});

test("toPublicGameState strips playerTokens and ownerToken", () => {
  const publicGame = toPublicGameState(baseGame());

  assert.equal(publicGame.playerTokens, undefined);
  assert.equal(publicGame.ownerToken, undefined);
  assert.equal(publicGame.id, "game-1");
});

test("toPublicGameState empties the deck and hides all hands with no viewer token", () => {
  const publicGame = toPublicGameState(baseGame());

  assert.deepEqual(publicGame.phase.cards.deck, []);
  assert.deepEqual(publicGame.phase.cards.hands, []);
});

test("toPublicGameState reveals only the viewer's hand when given a matching token", () => {
  const publicGame = toPublicGameState(baseGame(), "token-1");

  assert.deepEqual(publicGame.phase.cards.hands, [
    { playerId: "p1", cards: [{ rank: "K", suit: "Hearts" }] },
  ]);
});

test("toPublicGameState hides all hands when the viewer token does not match any player", () => {
  const publicGame = toPublicGameState(baseGame(), "unknown-token");

  assert.deepEqual(publicGame.phase.cards.hands, []);
});

test("toPublicGameState leaves phases without cards untouched", () => {
  const game = baseGame();
  game.phase = { stage: "Lobby" };

  const publicGame = toPublicGameState(game);

  assert.deepEqual(publicGame.phase, { stage: "Lobby" });
});

test("toPublicGameState prunes stale reactions", () => {
  const game = baseGame();
  game.reactions = [{ id: "old", playerId: "p1", createdAt: Date.now() - 60_000 }];

  const publicGame = toPublicGameState(game);

  assert.deepEqual(publicGame.reactions, []);
});
