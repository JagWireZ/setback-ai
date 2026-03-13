import type { Game } from "@shared/types/game";
import { GetItem } from "../../../../db";
import { normalizeGameId } from "../gameId/normalizeGameId";
import { isExpired, type GameStorageItem } from "./expiration";
import { tableName } from "./tableName";

export const getGameById = (gameId: string): Promise<Game | undefined> =>
  GetItem<GameStorageItem>({
    tableName: tableName(),
    key: { id: normalizeGameId(gameId) },
  }).then((item) => {
    if (!item || isExpired(item.expiresAt)) {
      return undefined;
    }

    const { expiresAt: _expiresAt, ...game } = item;
    return game;
  });
