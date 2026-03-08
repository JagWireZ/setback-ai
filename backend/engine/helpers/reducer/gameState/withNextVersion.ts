import type { Game } from "@shared/types/game";

export const withNextVersion = (game: Game, patch: Partial<Game>): Game => ({
  ...game,
  ...patch,
  version: game.version + 1,
});
