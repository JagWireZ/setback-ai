import type { Game } from "@shared/types/game";
import { requireGame } from "./requireGame";

export const requireVersion = (game: Game | undefined, version: number): void => {
  const existingGame = requireGame(game);
  if (version !== existingGame.version) {
    throw new Error("Version mismatch");
  }
};
