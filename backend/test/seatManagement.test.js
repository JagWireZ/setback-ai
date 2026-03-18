const test = require("node:test");
const assert = require("node:assert/strict");

const { addSeat } = require("../dist/backend/engine/reducer/addSeat.js");
const { removeSeat } = require("../dist/backend/engine/reducer/removeSeat.js");
const { joinGame } = require("../dist/backend/engine/reducer/joinGame.js");

const createLobbyGame = () => ({
  id: "game-1",
  version: 1,
  ownerToken: "owner-token",
  options: {
    maxCards: 10,
    blindBid: false,
    aiDifficulty: "medium",
    rounds: [],
  },
  players: [
    { id: "p1", name: "Owner", type: "human", connected: true },
    { id: "p2", name: "Robin", type: "human", connected: true },
    { id: "p3", name: "Sharp Shuffle", type: "ai", connected: true },
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
  phase: { stage: "Lobby" },
});

test("addSeat appends a new AI seat with token, score, and turn order entry", () => {
  const updated = addSeat(createLobbyGame(), {
    action: "addSeat",
    payload: {
      gameId: "game-1",
    },
  });

  assert.equal(updated.version, 2);
  assert.equal(updated.players.length, 4);
  const addedPlayer = updated.players[3];
  assert.equal(addedPlayer.type, "ai");
  assert.equal(updated.playerOrder[3], addedPlayer.id);
  assert.equal(updated.playerTokens.some((entry) => entry.playerId === addedPlayer.id), true);
  assert.equal(updated.scores.some((score) => score.playerId === addedPlayer.id), true);
});

test("addSeat rejects growing beyond eight seats", () => {
  assert.throws(
    () =>
      addSeat(
        {
          ...createLobbyGame(),
          players: Array.from({ length: 8 }, (_, index) => ({
            id: `p${index + 1}`,
            name: `Player ${index + 1}`,
            type: index < 2 ? "human" : "ai",
            connected: true,
          })),
          playerTokens: Array.from({ length: 8 }, (_, index) => ({
            playerId: `p${index + 1}`,
            token: `token-${index + 1}`,
          })),
          playerOrder: ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"],
          scores: Array.from({ length: 8 }, (_, index) => ({
            playerId: `p${index + 1}`,
            total: 0,
            possible: 0,
            rounds: [],
          })),
        },
        {
          action: "addSeat",
          payload: {
            gameId: "game-1",
          },
        },
      ),
    /cannot exceed 8 seats/i,
  );
});

test("removeSeat deletes an AI seat from all seat-indexed collections", () => {
  const updated = removeSeat(createLobbyGame(), {
    action: "removeSeat",
    payload: {
      gameId: "game-1",
      playerId: "p3",
    },
  });

  assert.equal(updated.version, 2);
  assert.deepEqual(updated.playerOrder, ["p1", "p2"]);
  assert.equal(updated.players.some((player) => player.id === "p3"), false);
  assert.equal(updated.playerTokens.some((entry) => entry.playerId === "p3"), false);
  assert.equal(updated.scores.some((score) => score.playerId === "p3"), false);
});

test("removeSeat rejects removing a human-controlled seat", () => {
  assert.throws(
    () =>
      removeSeat(createLobbyGame(), {
        action: "removeSeat",
        payload: {
          gameId: "game-1",
          playerId: "p2",
        },
      }),
    /only ai seats can be removed/i,
  );
});

test("removeSeat rejects shrinking below two seats", () => {
  assert.throws(
    () =>
      removeSeat(
        {
          ...createLobbyGame(),
          players: [
            { id: "p1", name: "Owner", type: "human", connected: true },
            { id: "p3", name: "Sharp Shuffle", type: "ai", connected: true },
          ],
          playerTokens: [
            { playerId: "p1", token: "owner-token" },
            { playerId: "p3", token: "token-3" },
          ],
          playerOrder: ["p1", "p3"],
          scores: [
            { playerId: "p1", total: 0, possible: 0, rounds: [] },
            { playerId: "p3", total: 0, possible: 0, rounds: [] },
          ],
        },
        {
          action: "removeSeat",
          payload: {
            gameId: "game-1",
            playerId: "p3",
          },
        },
      ),
    /must keep at least 2 seats/i,
  );
});

test("joinGame fills any available AI seat even when the game has more than five seats", () => {
  const updated = joinGame(
    {
      ...createLobbyGame(),
      players: [
        { id: "p1", name: "Owner", type: "human", connected: true },
        { id: "p2", name: "Robin", type: "human", connected: true },
        { id: "p3", name: "Jordan", type: "human", connected: true },
        { id: "p4", name: "Morgan", type: "human", connected: true },
        { id: "p5", name: "Taylor", type: "human", connected: true },
        { id: "p6", name: "Sharp Shuffle", type: "ai", connected: true },
      ],
      playerTokens: [
        { playerId: "p1", token: "owner-token" },
        { playerId: "p2", token: "token-2" },
        { playerId: "p3", token: "token-3" },
        { playerId: "p4", token: "token-4" },
        { playerId: "p5", token: "token-5" },
        { playerId: "p6", token: "token-6" },
      ],
      playerOrder: ["p1", "p2", "p3", "p4", "p5", "p6"],
      scores: [
        { playerId: "p1", total: 0, possible: 0, rounds: [] },
        { playerId: "p2", total: 0, possible: 0, rounds: [] },
        { playerId: "p3", total: 0, possible: 0, rounds: [] },
        { playerId: "p4", total: 0, possible: 0, rounds: [] },
        { playerId: "p5", total: 0, possible: 0, rounds: [] },
        { playerId: "p6", total: 0, possible: 0, rounds: [] },
      ],
    },
    {
      action: "joinGame",
      payload: {
        gameId: "game-1",
        playerName: "Casey",
      },
    },
  );

  assert.equal(updated.playerToken, "token-6");
  assert.equal(updated.game.players.find((player) => player.id === "p6").type, "human");
  assert.equal(updated.game.players.find((player) => player.id === "p6").name, "Casey");
});
