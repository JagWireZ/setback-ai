const test = require("node:test");
const assert = require("node:assert/strict");

const { playCard } = require("../dist/backend/engine/reducer/playCard.js");

const createPlayingGame = (overrides = {}) => ({
  id: "game-1",
  version: 1,
  ownerToken: "owner-token",
  options: {
    maxCards: 5,
    blindBid: false,
    rounds: [{ cardCount: 5, direction: "up" }],
  },
  players: [
    { id: "p1", name: "Player 1", type: "human", connected: true },
    { id: "p2", name: "Player 2", type: "human", connected: true },
  ],
  playerTokens: [
    { playerId: "p1", token: "token-1" },
    { playerId: "p2", token: "token-2" },
  ],
  playerOrder: ["p1", "p2"],
  scores: [
    { playerId: "p1", total: 0, possible: 0, rounds: [] },
    { playerId: "p2", total: 0, possible: 0, rounds: [] },
  ],
  phase: {
    stage: "Playing",
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
        {
          playerId: "p1",
          cards: [
            { rank: "9", suit: "Hearts" },
            { rank: "A", suit: "Spades" },
          ],
        },
        {
          playerId: "p2",
          cards: [
            { rank: "K", suit: "Hearts" },
            { rank: "Q", suit: "Clubs" },
          ],
        },
      ],
      currentTrick: {
        index: 0,
        leadPlayerId: "p2",
        plays: [],
      },
      completedTricks: [],
    },
  },
  ...overrides,
});

test("playCard rejects a non-lead-suit card when the player can follow suit", () => {
  const game = createPlayingGame({
    phase: {
      stage: "Playing",
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
          {
            playerId: "p1",
            cards: [
              { rank: "9", suit: "Hearts" },
              { rank: "A", suit: "Spades" },
            ],
          },
          {
            playerId: "p2",
            cards: [{ rank: "Q", suit: "Clubs" }],
          },
        ],
        currentTrick: {
          index: 0,
          leadPlayerId: "p2",
          plays: [{ playerId: "p2", card: { rank: "K", suit: "Hearts" } }],
        },
        completedTricks: [],
      },
    },
  });

  assert.throws(
    () =>
      playCard(game, {
        action: "playCard",
        payload: {
          gameId: "game-1",
          playerToken: "token-1",
          card: { rank: "A", suit: "Spades" },
        },
      }),
    /follow the leading suit/i,
  );
});

test("playCard rejects leading with trump before trump is broken when the player has a non-trump card", () => {
  const game = createPlayingGame();

  assert.throws(
    () =>
      playCard(game, {
        action: "playCard",
        payload: {
          gameId: "game-1",
          playerToken: "token-1",
          card: { rank: "A", suit: "Spades" },
        },
      }),
    /cannot lead with trump/i,
  );
});

test("playCard advances the turn and records the play when the move is legal", () => {
  const game = createPlayingGame();

  const updated = playCard(game, {
    action: "playCard",
    payload: {
      gameId: "game-1",
      playerToken: "token-1",
      card: { rank: "9", suit: "Hearts" },
    },
  });

  assert.equal(updated.version, 2);
  assert.equal(updated.phase.turnPlayerId, "p2");
  assert.deepEqual(updated.phase.cards.currentTrick.plays, [
    { playerId: "p1", card: { rank: "9", suit: "Hearts" } },
  ]);
  assert.deepEqual(
    updated.phase.cards.hands.find((hand) => hand.playerId === "p1").cards,
    [{ rank: "A", suit: "Spades" }],
  );
});

test("playCard resolves the trick winner and rotates the lead once all players have played", () => {
  const game = createPlayingGame({
    phase: {
      stage: "Playing",
      dealerPlayerId: "p2",
      roundIndex: 0,
      trickIndex: 0,
      turnPlayerId: "p1",
      bids: [
        { playerId: "p1", amount: 1, trip: false },
        { playerId: "p2", amount: 0, trip: false },
      ],
      cards: {
        deck: [],
        trump: { rank: "A", suit: "Spades" },
        trumpBroken: false,
        hands: [
          { playerId: "p1", cards: [{ rank: "9", suit: "Hearts" }] },
          { playerId: "p2", cards: [{ rank: "K", suit: "Hearts" }] },
        ],
        currentTrick: {
          index: 0,
          leadPlayerId: "p1",
          plays: [],
        },
        completedTricks: [],
      },
    },
  });

  const afterFirstPlay = playCard(game, {
    action: "playCard",
    payload: {
      gameId: "game-1",
      playerToken: "token-1",
      card: { rank: "9", suit: "Hearts" },
    },
  });

  const afterTrick = playCard(afterFirstPlay, {
    action: "playCard",
    payload: {
      gameId: "game-1",
      playerToken: "token-2",
      card: { rank: "K", suit: "Hearts" },
    },
  });

  assert.equal(afterTrick.phase.stage, "EndOfRound");
  assert.equal(afterTrick.phase.cards.completedTricks.length, 1);
  assert.equal(afterTrick.phase.cards.completedTricks[0].winnerPlayerId, "p2");
});

test("playCard rejects playing outside the Playing phase", () => {
  const game = createPlayingGame({ phase: { stage: "Bidding" } });

  assert.throws(
    () =>
      playCard(game, {
        action: "playCard",
        payload: {
          gameId: "game-1",
          playerToken: "token-1",
          card: { rank: "9", suit: "Hearts" },
        },
      }),
    /only be played during playing phase/i,
  );
});

test("playCard rejects a play when it is not the player's turn", () => {
  const game = createPlayingGame();

  assert.throws(
    () =>
      playCard(game, {
        action: "playCard",
        payload: {
          gameId: "game-1",
          playerToken: "token-2",
          card: { rank: "K", suit: "Hearts" },
        },
      }),
    /not this player's turn/i,
  );
});

test("playCard rejects a card that is not in the player's hand", () => {
  const game = createPlayingGame();

  assert.throws(
    () =>
      playCard(game, {
        action: "playCard",
        payload: {
          gameId: "game-1",
          playerToken: "token-1",
          card: { rank: "K", suit: "Diamonds" },
        },
      }),
    /not found in current player's hand/i,
  );
});

test("playCard rejects an invalid or stale player token", () => {
  const game = createPlayingGame();

  assert.throws(
    () =>
      playCard(game, {
        action: "playCard",
        payload: {
          gameId: "game-1",
          playerToken: "stale-token",
          card: { rank: "9", suit: "Hearts" },
        },
      }),
    /invalid player token/i,
  );
});
