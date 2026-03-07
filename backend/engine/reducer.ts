import type { CardCount, Game, Player, Score } from "@shared/types/game";
import type { LambdaEventPayload } from "@shared/types/lambda";
import { generateGameId } from "./helpers/generateGameId";
import { generatePlayerId } from "./helpers/generatePlayerId";
import { generatePlayerToken } from "./helpers/generatePlayerToken";

const DEFAULT_MAX_CARDS: CardCount = 10;

export const engineReducer = (
  game: Game | undefined,
  event: LambdaEventPayload,
): Game => {
  switch (event.action) {
    case "createGame":
      return createGame(event);
    case "joinGame":
      return joinGame(game, event);
    case "setOptions":
      requirePlayerToken(game, event.payload.playerToken);
      return setOptions(game, event);
    case "startGame":
    case "dealCards":
    case "submitBid":
    case "playCard":
      requirePlayerToken(game, event.payload.playerToken);
      return requireGame(game);
    case "movePlayer":
      requirePlayerToken(game, event.payload.playerToken);
      return movePlayer(game, event);
    case "removePlayer":
      requirePlayerToken(game, event.payload.playerToken);
      return removePlayer(game, event);
    case "reconnectPlayer":
    case "getGameState":
      requirePlayerToken(game, event.payload.playerToken);
      return requireGame(game);
    default:
      return assertNever(event);
  }
};

const createGame = (event: LambdaEventPayload<"createGame">): Game => {
  const hostPlayer = buildPlayer(event.payload.playerName);
  return {
    id: generateGameId(),
    options: {
      maxCards: DEFAULT_MAX_CARDS,
    },
    players: [hostPlayer],
    playerOrder: [hostPlayer.id],
    scores: [buildScore(hostPlayer.id)],
  };
};

const joinGame = (game: Game | undefined, event: LambdaEventPayload<"joinGame">): Game => {
  const existingGame = requireGame(game);
  if (existingGame.id !== event.payload.gameId) {
    throw new Error("Game ID mismatch");
  }

  const nextPlayer = buildPlayer(event.payload.playerName);
  return {
    ...existingGame,
    players: [...existingGame.players, nextPlayer],
    playerOrder: [...existingGame.playerOrder, nextPlayer.id],
    scores: [...existingGame.scores, buildScore(nextPlayer.id)],
  };
};

const setOptions = (game: Game | undefined, event: LambdaEventPayload<"setOptions">): Game => {
  const existingGame = requireGame(game);
  if (existingGame.id !== event.payload.gameId) {
    throw new Error("Game ID mismatch");
  }

  return {
    ...existingGame,
    options: {
      ...existingGame.options,
      maxCards: event.payload.maxCards,
    },
  };
};

const movePlayer = (game: Game | undefined, event: LambdaEventPayload<"movePlayer">): Game => {
  const existingGame = requireGame(game);
  if (existingGame.id !== event.payload.gameId) {
    throw new Error("Game ID mismatch");
  }

  const currentIndex = existingGame.playerOrder.indexOf(event.payload.playerId);
  if (currentIndex === -1) {
    throw new Error("Player not found in playerOrder");
  }

  const { direction } = event.payload;
  if (direction !== "left" && direction !== "right") {
    throw new Error('movePlayer direction must be "left" or "right"');
  }

  const total = existingGame.playerOrder.length;
  const nextIndex =
    direction === "left"
      ? (currentIndex - 1 + total) % total
      : (currentIndex + 1) % total;

  const nextOrder = [...existingGame.playerOrder];
  [nextOrder[currentIndex], nextOrder[nextIndex]] = [
    nextOrder[nextIndex],
    nextOrder[currentIndex],
  ];

  return {
    ...existingGame,
    playerOrder: nextOrder,
  };
};

const removePlayer = (game: Game | undefined, event: LambdaEventPayload<"removePlayer">): Game => {
  const existingGame = requireGame(game);
  if (existingGame.id !== event.payload.gameId) {
    throw new Error("Game ID mismatch");
  }

  return {
    ...existingGame,
    players: existingGame.players.filter((player) => player.id !== event.payload.playerId),
    playerOrder: existingGame.playerOrder.filter((playerId) => playerId !== event.payload.playerId),
    scores: existingGame.scores.filter((score) => score.playerId !== event.payload.playerId),
  };
};

const requireGame = (game: Game | undefined): Game => {
  if (!game) {
    throw new Error("Game not found");
  }
  return game;
};

const requirePlayerToken = (game: Game | undefined, playerToken: string): void => {
  const existingGame = requireGame(game);
  const hasPlayer = existingGame.players.some((player) => player.token === playerToken);
  if (!hasPlayer) {
    throw new Error("Invalid player token");
  }
};

const buildPlayer = (name: string): Player => ({
  id: generatePlayerId(),
  token: generatePlayerToken(),
  name,
  type: "human",
});

const buildScore = (playerId: string): Score => ({
  playerId,
  total: 0,
  possible: 0,
});

const assertNever = (value: never): never => {
  throw new Error(`Unhandled action: ${JSON.stringify(value)}`);
};
