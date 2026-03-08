import type { Game } from "@shared/types/game";

export const requireGame = (game: Game | undefined): Game => {
  if (!game) {
    throw new Error("Game not found");
  }
  return game;
};
