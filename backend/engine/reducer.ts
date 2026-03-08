import type { Game, Player, PlayerToken, Score } from "@shared/types/game";
import type { LambdaEventPayload } from "@shared/types/lambda";
import { DeleteItem, GetItem, PutItem } from "../db";
import { generateGameId } from "./helpers/generateGameId";
import { generatePlayerId } from "./helpers/generatePlayerId";
import { generatePlayerToken } from "./helpers/generatePlayerToken";
import { generateRounds } from "./helpers/generateRounds";

export type PublicGameState = Omit<Game, "playerTokens" | "ownerToken">;

export type EngineReducerResult = {
  game?: PublicGameState;
  playerToken?: string;
};

type JoinGameResult = {
  game: Game;
  playerToken: string;
};

export const engineReducer = (
  game: Game | undefined,
  event: LambdaEventPayload,
): Promise<EngineReducerResult> => {
  switch (event.action) {
    case "createGame": {
      const created = createGame(event);
      return putGame(created.game).then(() => toResult(created.game, created.playerToken));
    }
    case "joinGame": {
      const joined = joinGame(game, event);
      return putGame(joined.game).then(() => toResult(joined.game, joined.playerToken));
    }
    case "setOptions": {
      requireOwnerToken(game, event.payload.playerToken);
      requireVersion(game, event.payload.version);
      const updatedGame = setOptions(game, event);
      return putGame(updatedGame).then(() => toResult(updatedGame));
    }
    case "startGame": {
      requireOwnerToken(game, event.payload.playerToken);
      requireVersion(game, event.payload.version);
      const updatedGame = startGame(game, event);
      return putGame(updatedGame).then(() => toResult(updatedGame));
    }
    case "dealCards":
    case "submitBid":
    case "playCard": {
      requirePlayerToken(game, event.payload.playerToken);
      requireVersion(game, event.payload.version);
      const existingGame = requireGame(game);
      return putGame(existingGame).then(() => toResult(existingGame));
    }
    case "movePlayer": {
      requireOwnerToken(game, event.payload.playerToken);
      requireVersion(game, event.payload.version);
      const updatedGame = movePlayer(game, event);
      return putGame(updatedGame).then(() => toResult(updatedGame));
    }
    case "removePlayer": {
      requireOwnerToken(game, event.payload.playerToken);
      requireVersion(game, event.payload.version);
      const updatedGame = removePlayer(game, event);
      return putGame(updatedGame).then(() => toResult(updatedGame));
    }
    case "removeGame":
      return removeGame(event);
    case "reconnectPlayer": {
      requirePlayerToken(game, event.payload.playerToken);
      requireVersion(game, event.payload.version);
      const existingGame = requireGame(game);
      return putGame(existingGame).then(() => toResult(existingGame));
    }
    case "getGameState":
      return getGameState(game, event);
    default:
      return Promise.resolve(assertNever(event));
  }
};

const createGame = (
  event: LambdaEventPayload<"createGame">,
): { game: Game; playerToken: string } => {
  const hostPlayer = buildPlayer(event.payload.playerName);
  const hostPlayerToken = buildPlayerToken(hostPlayer.id);
  const game: Game = {
    id: generateGameId(),
    version: 1,
    ownerToken: hostPlayerToken.token,
    options: {
      maxCards: event.payload.maxCards,
      blindBid: false,
      rounds: generateRounds(event.payload.maxCards),
    },
    players: [hostPlayer],
    playerTokens: [hostPlayerToken],
    playerOrder: [hostPlayer.id],
    scores: [buildScore(hostPlayer.id)],
  };

  return {
    game,
    playerToken: hostPlayerToken.token,
  };
};

const joinGame = (
  game: Game | undefined,
  event: LambdaEventPayload<"joinGame">,
): JoinGameResult => {
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

  return {
    game: updatedGame,
    playerToken: nextPlayerToken.token,
  };
};

const setOptions = (
  game: Game | undefined,
  event: LambdaEventPayload<"setOptions">,
): Game => {
  const existingGame = requireGame(game);
  if (existingGame.id !== event.payload.gameId) {
    throw new Error("Game ID mismatch");
  }

  return withNextVersion(existingGame, {
    options: {
      ...existingGame.options,
      maxCards: event.payload.maxCards,
      blindBid: event.payload.blindBid,
    },
  });
};

const startGame = (
  game: Game | undefined,
  event: LambdaEventPayload<"startGame">,
): Game => {
  const existingGame = requireGame(game);
  if (existingGame.id !== event.payload.gameId) {
    throw new Error("Game ID mismatch");
  }

  return withNextVersion(existingGame, {
    options: {
      ...existingGame.options,
      rounds: generateRounds(existingGame.options.maxCards),
    },
  });
};

const movePlayer = (
  game: Game | undefined,
  event: LambdaEventPayload<"movePlayer">,
): Game => {
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

  return withNextVersion(existingGame, {
    playerOrder: nextOrder,
  });
};

const removePlayer = (
  game: Game | undefined,
  event: LambdaEventPayload<"removePlayer">,
): Game => {
  const existingGame = requireGame(game);
  if (existingGame.id !== event.payload.gameId) {
    throw new Error("Game ID mismatch");
  }

  return withNextVersion(existingGame, {
    players: existingGame.players.filter((player) => player.id !== event.payload.playerId),
    playerTokens: existingGame.playerTokens.filter(
      (playerToken) => playerToken.playerId !== event.payload.playerId,
    ),
    playerOrder: existingGame.playerOrder.filter((playerId) => playerId !== event.payload.playerId),
    scores: existingGame.scores.filter((score) => score.playerId !== event.payload.playerId),
  });
};

const getGameState = (
  _game: Game | undefined,
  event: LambdaEventPayload<"getGameState">,
): Promise<EngineReducerResult> => {
  return getGameById(event.payload.gameId).then((existingGame) => {
    if (!existingGame) {
      throw new Error("Game not found");
    }

    requirePlayerToken(existingGame, event.payload.playerToken);

    if (event.payload.version < existingGame.version) {
      return toResult(existingGame);
    }

    return {};
  });
};

const removeGame = (
  event: LambdaEventPayload<"removeGame">,
): Promise<EngineReducerResult> =>
  getGameById(event.payload.gameId).then((existingGame) => {
    if (!existingGame) {
      throw new Error("Game not found");
    }

    requireOwnerToken(existingGame, event.payload.playerToken);

    return deleteGameById(event.payload.gameId).then(() => ({}));
  });

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

const requireOwnerToken = (game: Game | undefined, playerToken: string): void => {
  const existingGame = requireGame(game);
  if (existingGame.ownerToken !== playerToken) {
    throw new Error("Owner token required");
  }
};

const requireVersion = (game: Game | undefined, version: number): void => {
  const existingGame = requireGame(game);
  if (version !== existingGame.version) {
    throw new Error("Version mismatch");
  }
};

const buildPlayer = (name: string): Player => ({
  id: generatePlayerId(),
  name,
  type: "human",
  connected: true
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
  const { playerTokens: _playerTokens, ownerToken: _ownerToken, ...publicGame } = game;
  return publicGame;
};

const toResult = (game: Game, playerToken?: string): EngineReducerResult => ({
  game: toPublicGameState(game),
  playerToken,
});

const tableName = (): string => {
  const value =
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
      ?.DYNAMODB_TABLE_NAME;
  if (!value) {
    throw new Error("Missing DYNAMODB_TABLE_NAME");
  }
  return value;
};

const putGame = (game: Game): Promise<void> =>
  PutItem<Game>({
    tableName: tableName(),
    item: game,
  });

const getGameById = (gameId: string): Promise<Game | undefined> =>
  GetItem<Game>({
    tableName: tableName(),
    key: { id: gameId },
  });

const deleteGameById = (gameId: string): Promise<void> =>
  DeleteItem({
    tableName: tableName(),
    key: { id: gameId },
  });

const assertNever = (value: never): never => {
  throw new Error(`Unhandled action: ${JSON.stringify(value)}`);
};
