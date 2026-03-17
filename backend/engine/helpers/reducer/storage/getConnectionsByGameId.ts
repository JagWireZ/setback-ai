import { QueryItems } from "../../../../db";
import { isExpired } from "./expiration";
import { tableName } from "./tableName";
import { type ConnectionItem } from "./connectionItem";

export const getConnectionsByGameId = async (gameId: string): Promise<ConnectionItem[]> => {
  const items = await QueryItems<ConnectionItem>({
    tableName: tableName(),
    indexName: "gameId-entityType-index",
    keyConditionExpression: "#gameId = :gameId AND begins_with(#entityType, :connectionPrefix)",
    expressionAttributeNames: {
      "#gameId": "gameId",
      "#entityType": "entityType",
    },
    expressionAttributeValues: {
      ":gameId": gameId,
      ":connectionPrefix": "connection#",
    },
  });

  return items.filter((item) => !isExpired(item.expiresAt));
};
