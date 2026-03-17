import type { Game, PlayerToken } from "@shared/types/game";
import { withExpiration, type ExpiringItem } from "./expiration";

const VERSION_ITEM_SUFFIX = "#version";

export type GameVersionItem = {
  id: string;
  gameId: string;
  entityType: string;
  version: number;
  playerTokens: PlayerToken[];
} & ExpiringItem;

export const gameVersionItemId = (gameId: string): string => `${gameId}${VERSION_ITEM_SUFFIX}`;

export const toGameVersionItem = (game: Game): GameVersionItem =>
  withExpiration({
    id: gameVersionItemId(game.id),
    gameId: game.id,
    entityType: "version",
    version: game.version,
    playerTokens: game.playerTokens,
  });
