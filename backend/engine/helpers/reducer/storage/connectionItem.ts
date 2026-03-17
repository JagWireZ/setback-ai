import { withExpiration, type ExpiringItem } from "./expiration";

const CONNECTION_ITEM_PREFIX = "connection#";

export type ConnectionItem = {
  id: string;
  gameId: string;
  entityType: string;
  connectionId: string;
  playerToken: string;
} & ExpiringItem;

export const connectionItemId = (connectionId: string): string =>
  `${CONNECTION_ITEM_PREFIX}${connectionId}`;

export const connectionEntityType = (connectionId: string): string =>
  `${CONNECTION_ITEM_PREFIX}${connectionId}`;

export const toConnectionItem = (
  connectionId: string,
  gameId: string,
  playerToken: string,
): ConnectionItem =>
  withExpiration({
    id: connectionItemId(connectionId),
    gameId,
    entityType: connectionEntityType(connectionId),
    connectionId,
    playerToken,
  });
