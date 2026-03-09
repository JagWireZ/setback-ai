import { GetItem } from "../../../../db";
import { tableName } from "./tableName";
import { gameVersionItemId, type GameVersionItem } from "./gameVersionItem";

export const getGameVersionById = (gameId: string): Promise<GameVersionItem | undefined> =>
  GetItem<GameVersionItem>({
    tableName: tableName(),
    key: { id: gameVersionItemId(gameId) },
  });
