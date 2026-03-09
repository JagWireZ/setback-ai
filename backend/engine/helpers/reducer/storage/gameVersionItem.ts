import type { Game, PlayerToken } from "@shared/types/game";

const VERSION_ITEM_SUFFIX = "#version";

export type GameVersionItem = {
  id: string;
  gameId: string;
  version: number;
  playerTokens: PlayerToken[];
};

export const gameVersionItemId = (gameId: string): string => `${gameId}${VERSION_ITEM_SUFFIX}`;

export const toGameVersionItem = (game: Game): GameVersionItem => ({
  id: gameVersionItemId(game.id),
  gameId: game.id,
  version: game.version,
  playerTokens: game.playerTokens,
});
