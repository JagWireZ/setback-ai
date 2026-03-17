import { DeleteItem } from "../../../../db";
import { connectionItemId } from "./connectionItem";
import { tableName } from "./tableName";

export const deleteConnectionById = (connectionId: string): Promise<void> =>
  DeleteItem({
    tableName: tableName(),
    key: { id: connectionItemId(connectionId) },
  });
