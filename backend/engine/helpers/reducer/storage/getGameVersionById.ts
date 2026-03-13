import { GetItem } from "../../../../db";
import { isExpired } from "./expiration";
import { tableName } from "./tableName";
import { gameVersionItemId, type GameVersionItem } from "./gameVersionItem";

export const getGameVersionById = (gameId: string): Promise<GameVersionItem | undefined> =>
  GetItem<GameVersionItem>({
    tableName: tableName(),
    key: { id: gameVersionItemId(gameId) },
  }).then((item) => {
    if (!item || isExpired(item.expiresAt)) {
      return undefined;
    }

    return item;
  });
