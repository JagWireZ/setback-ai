import type { Game } from "@shared/types/game";
import { requireGame } from "./requireGame";

export const requireOwnerToken = (game: Game | undefined, playerToken: string): void => {
  const existingGame = requireGame(game);
  if (existingGame.ownerToken !== playerToken) {
    throw new Error("Owner token required");
  }
};
