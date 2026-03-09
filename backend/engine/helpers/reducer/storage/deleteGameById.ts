import { TransactWriteItems } from "../../../../db";
import { tableName } from "./tableName";
import { gameVersionItemId } from "./gameVersionItem";

export const deleteGameById = (gameId: string): Promise<void> =>
  TransactWriteItems({
    items: [
      {
        delete: {
          tableName: tableName(),
          key: { id: gameId },
        },
      },
      {
        delete: {
          tableName: tableName(),
          key: { id: gameVersionItemId(gameId) },
        },
      },
    ],
  });
