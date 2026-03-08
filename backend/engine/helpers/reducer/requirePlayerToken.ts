import type { Game } from "@shared/types/game";
import { requireGame } from "./requireGame";

export const requirePlayerToken = (game: Game | undefined, playerToken: string): void => {
  const existingGame = requireGame(game);
  const hasPlayer = existingGame.playerTokens.some((entry) => entry.token === playerToken);
  if (!hasPlayer) {
    throw new Error("Invalid player token");
  }
};
