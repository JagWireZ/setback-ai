import {
  ApiGatewayManagementApiClient,
  DeleteConnectionCommand,
  GetConnectionCommand,
  GoneException,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import type { Game } from "@shared/types/game";
import { toResult } from "../engine/helpers/reducer/gameState/toResult";
import { deleteConnectionById } from "../engine/helpers/reducer/storage/deleteConnectionById";
import type { ConnectionItem } from "../engine/helpers/reducer/storage/connectionItem";
import { getConnectionsByGameId } from "../engine/helpers/reducer/storage/getConnectionsByGameId";
import { getGameById } from "../engine/helpers/reducer/storage/getGameById";

type SocketEnvelope =
  | {
      type: "response";
      requestId: string;
      ok: true;
      result: unknown;
    }
  | {
      type: "response";
      requestId: string;
      ok: false;
      error: string;
    }
  | {
      type: "gameState";
      gameId: string;
      result: ReturnType<typeof toResult>;
    }
  | {
      type: "playerRemoved";
      gameId: string;
      message: string;
    }
  | {
      type: "gameRemoved";
      gameId: string;
      message: string;
    };

const createManagementClient = (domainName: string, stage: string): ApiGatewayManagementApiClient =>
  new ApiGatewayManagementApiClient({
    endpoint: `https://${domainName}/${stage}`,
  });

const postMessage = async (
  client: ApiGatewayManagementApiClient,
  connectionId: string,
  message: SocketEnvelope,
): Promise<void> => {
  await client.send(
    new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify(message),
    }),
  );
};

const deleteStaleConnection = async (
  client: ApiGatewayManagementApiClient,
  connectionId: string,
): Promise<void> => {
  await deleteConnectionById(connectionId);

  try {
    await client.send(
      new DeleteConnectionCommand({
        ConnectionId: connectionId,
      }),
    );
  } catch {
    // Best effort cleanup after the DynamoDB record is removed.
  }
};

const postBestEffort = async (
  client: ApiGatewayManagementApiClient,
  connectionId: string,
  message: SocketEnvelope,
): Promise<void> => {
  try {
    await postMessage(client, connectionId, message);
  } catch (error) {
    if (error instanceof GoneException) {
      await deleteStaleConnection(client, connectionId);
      return;
    }

    throw error;
  }
};

const buildRemovedMessage = (gameId: string): SocketEnvelope => ({
  type: "playerRemoved",
  gameId,
  message: `You have been removed from game ${gameId}.`,
});

export const sendSocketResponse = (
  domainName: string,
  stage: string,
  connectionId: string,
  message: SocketEnvelope,
): Promise<void> => {
  const client = createManagementClient(domainName, stage);
  return postBestEffort(client, connectionId, message);
};

const isLiveConnection = async (
  client: ApiGatewayManagementApiClient,
  connectionId: string,
): Promise<boolean> => {
  try {
    await client.send(
      new GetConnectionCommand({
        ConnectionId: connectionId,
      }),
    );
    return true;
  } catch (error) {
    if (error instanceof GoneException) {
      await deleteConnectionById(connectionId);
      return false;
    }

    return true;
  }
};

export const filterLiveConnections = async (
  domainName: string,
  stage: string,
  connections: ConnectionItem[],
): Promise<ConnectionItem[]> => {
  const client = createManagementClient(domainName, stage);
  const statuses = await Promise.all(
    connections.map(async (connection) => ({
      connection,
      active: await isLiveConnection(client, connection.connectionId),
    })),
  );

  return statuses
    .filter((entry) => entry.active)
    .map((entry) => entry.connection);
};

const buildPersonalizedState = (game: Game, playerToken: string) =>
  toResult(game, undefined, playerToken);

export const broadcastGameState = async (
  domainName: string,
  stage: string,
  gameId: string,
): Promise<void> => {
  const client = createManagementClient(domainName, stage);
  const [storedConnections, latestGame] = await Promise.all([
    getConnectionsByGameId(gameId),
    getGameById(gameId),
  ]);
  const connections = await filterLiveConnections(domainName, stage, storedConnections);

  if (!latestGame) {
    await Promise.all(
      connections.map(async (connection) => {
        await postBestEffort(client, connection.connectionId, {
          type: "gameRemoved",
          gameId,
          message: `Game ${gameId} is no longer available.`,
        });
        await deleteConnectionById(connection.connectionId);
      }),
    );
    return;
  }

  await Promise.all(
    connections.map(async (connection) => {
      const stillHasSeat = latestGame.playerTokens.some(
        (entry) => entry.token === connection.playerToken,
      );

      if (!stillHasSeat) {
        await postBestEffort(client, connection.connectionId, buildRemovedMessage(gameId));
        await deleteConnectionById(connection.connectionId);
        return;
      }

      await postBestEffort(client, connection.connectionId, {
        type: "gameState",
        gameId,
        result: buildPersonalizedState(latestGame, connection.playerToken),
      });
    }),
  );
};
