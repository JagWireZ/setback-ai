import type { CardCount, Game, Player, PlayerToken, Score } from "@shared/types/game";
import type { LambdaEventPayload } from "@shared/types/lambda";
import { generateGameId } from "./helpers/generateGameId";
import { generatePlayerId } from "./helpers/generatePlayerId";
import { generatePlayerToken } from "./helpers/generatePlayerToken";

const DEFAULT_MAX_CARDS: CardCount = 10;

export type PublicGameState = Omit<Game, "playerTokens">;

export type EngineReducerResult = {
  game?: PublicGameState;
  playerToken?: string;
};

export const engineReducer = (
  game: Game | undefined,
  event: LambdaEventPayload,
): EngineReducerResult => {
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
      return toResult(requireGame(game));
    case "movePlayer":
      requirePlayerToken(game, event.payload.playerToken);
      return movePlayer(game, event);
    case "removePlayer":
      requirePlayerToken(game, event.payload.playerToken);
      return removePlayer(game, event);
    case "reconnectPlayer":
      requirePlayerToken(game, event.payload.playerToken);
      return toResult(requireGame(game));
    case "getGameState":
      requirePlayerToken(game, event.payload.playerToken);
      return getGameState(game, event);
    default:
      return assertNever(event);
  }
};

const createGame = (event: LambdaEventPayload<"createGame">): EngineReducerResult => {
  const hostPlayer = buildPlayer(event.payload.playerName);
  const hostPlayerToken = buildPlayerToken(hostPlayer.id);
  const game: Game = {
    id: generateGameId(),
    version: 1,
    options: {
      maxCards: DEFAULT_MAX_CARDS,
    },
    players: [hostPlayer],
    playerTokens: [hostPlayerToken],
    playerOrder: [hostPlayer.id],
    scores: [buildScore(hostPlayer.id)],
  };

  return toResult(game, hostPlayerToken.token);
};

const joinGame = (
  game: Game | undefined,
  event: LambdaEventPayload<"joinGame">,
): EngineReducerResult => {
  const existingGame = requireGame(game);
  if (existingGame.id !== event.payload.gameId) {
    throw new Error("Game ID mismatch");
  }

  const nextPlayer = buildPlayer(event.payload.playerName);
  const nextPlayerToken = buildPlayerToken(nextPlayer.id);
  const updatedGame = withNextVersion(existingGame, {
    players: [...existingGame.players, nextPlayer],
    playerTokens: [...existingGame.playerTokens, nextPlayerToken],
    playerOrder: [...existingGame.playerOrder, nextPlayer.id],
    scores: [...existingGame.scores, buildScore(nextPlayer.id)],
  });

  return toResult(updatedGame, nextPlayerToken.token);
};

const setOptions = (
  game: Game | undefined,
  event: LambdaEventPayload<"setOptions">,
): EngineReducerResult => {
  const existingGame = requireGame(game);
  if (existingGame.id !== event.payload.gameId) {
    throw new Error("Game ID mismatch");
  }

  const updatedGame = withNextVersion(existingGame, {
    options: {
      ...existingGame.options,
      maxCards: event.payload.maxCards,
    },
  });

  return toResult(updatedGame);
};

const movePlayer = (
  game: Game | undefined,
  event: LambdaEventPayload<"movePlayer">,
): EngineReducerResult => {
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

  const updatedGame = withNextVersion(existingGame, {
    playerOrder: nextOrder,
  });

  return toResult(updatedGame);
};

const removePlayer = (
  game: Game | undefined,
  event: LambdaEventPayload<"removePlayer">,
): EngineReducerResult => {
  const existingGame = requireGame(game);
  if (existingGame.id !== event.payload.gameId) {
    throw new Error("Game ID mismatch");
  }

  const updatedGame = withNextVersion(existingGame, {
    players: existingGame.players.filter((player) => player.id !== event.payload.playerId),
    playerTokens: existingGame.playerTokens.filter(
      (playerToken) => playerToken.playerId !== event.payload.playerId,
    ),
    playerOrder: existingGame.playerOrder.filter((playerId) => playerId !== event.payload.playerId),
    scores: existingGame.scores.filter((score) => score.playerId !== event.payload.playerId),
  });

  return toResult(updatedGame);
};

const getGameState = (
  game: Game | undefined,
  event: LambdaEventPayload<"getGameState">,
): EngineReducerResult => {
  const existingGame = requireGame(game);
  if (existingGame.id !== event.payload.gameId) {
    throw new Error("Game ID mismatch");
  }

  if (event.payload.version < existingGame.version) {
    return toResult(existingGame);
  }

  return {};
};

const requireGame = (game: Game | undefined): Game => {
  if (!game) {
    throw new Error("Game not found");
  }
  return game;
};

const requirePlayerToken = (game: Game | undefined, playerToken: string): void => {
  const existingGame = requireGame(game);
  const hasPlayer = existingGame.playerTokens.some((entry) => entry.token === playerToken);
  if (!hasPlayer) {
    throw new Error("Invalid player token");
  }
};

const buildPlayer = (name: string): Player => ({
  id: generatePlayerId(),
  name,
  type: "human",
});

const buildPlayerToken = (playerId: string): PlayerToken => ({
  playerId,
  token: generatePlayerToken(),
});

const buildScore = (playerId: string): Score => ({
  playerId,
  total: 0,
  possible: 0,
});

const withNextVersion = (game: Game, patch: Partial<Game>): Game => ({
  ...game,
  ...patch,
  version: game.version + 1,
});

const toPublicGameState = (game: Game): PublicGameState => {
  const { playerTokens: _playerTokens, ...publicGame } = game;
  return publicGame;
};

const toResult = (game: Game, playerToken?: string): EngineReducerResult => ({
  game: toPublicGameState(game),
  playerToken,
});

const assertNever = (value: never): never => {
  throw new Error(`Unhandled action: ${JSON.stringify(value)}`);
};
