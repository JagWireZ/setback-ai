import { PutItem } from "../../../../db";
import { normalizeGameId } from "../gameId/normalizeGameId";
import { tableName } from "./tableName";
import { toConnectionItem } from "./connectionItem";

export const putConnection = (
  connectionId: string,
  gameId: string,
  playerToken: string,
): Promise<void> =>
  PutItem({
    tableName: tableName(),
    item: toConnectionItem(connectionId, normalizeGameId(gameId), playerToken),
  });
