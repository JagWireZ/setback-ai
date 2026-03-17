import { GetItem } from "../../../../db";
import { isExpired } from "./expiration";
import { connectionItemId, type ConnectionItem } from "./connectionItem";
import { tableName } from "./tableName";

export const getConnectionById = async (connectionId: string): Promise<ConnectionItem | undefined> => {
  const item = await GetItem<ConnectionItem>({
    tableName: tableName(),
    key: { id: connectionItemId(connectionId) },
  });

  if (!item || isExpired(item.expiresAt)) {
    return undefined;
  }

  return item;
};
