import { DeleteItem } from "../../../db";
import { tableName } from "./tableName";

export const deleteGameById = (gameId: string): Promise<void> =>
  DeleteItem({
    tableName: tableName(),
    key: { id: gameId },
  });
