import type { Game, PlayerToken } from "@shared/types/game";
import { requireGame } from "./requireGame";

type EventWithGameId = {
  payload: {
    gameId: string;
  };
};

type EventWithPlayerToken = {
  payload: {
    gameId: string;
    playerToken: string;
  };
};

export const requireGameForAction = (
  game: Game | undefined,
  event: EventWithGameId,
): Game => {
  const existingGame = requireGame(game);
  if (existingGame.id !== event.payload.gameId) {
    throw new Error("Game ID mismatch");
  }

  return existingGame;
};

export const requirePlayerTokenEntry = (
  game: Game,
  playerToken: string,
): PlayerToken => {
  const playerTokenEntry = game.playerTokens.find((entry) => entry.token === playerToken);
  if (!playerTokenEntry) {
    throw new Error("Invalid player token");
  }

  return playerTokenEntry;
};

export const requirePlayerActionContext = (
  game: Game | undefined,
  event: EventWithPlayerToken,
): { game: Game; playerId: string; playerTokenEntry: PlayerToken } => {
  const existingGame = requireGameForAction(game, event);
  const playerTokenEntry = requirePlayerTokenEntry(existingGame, event.payload.playerToken);

  return {
    game: existingGame,
    playerId: playerTokenEntry.playerId,
    playerTokenEntry,
  };
};
