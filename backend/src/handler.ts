import {
  APIGatewayProxyWebsocketEventV2,
  APIGatewayProxyWebsocketHandlerV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import type { LambdaEventPayload } from "@shared/types/lambda";
import { engineReducer } from "../engine";
import { runAiTurnsForGame } from "../engine/ai/runAiTurnsForGame";
import { setPlayerConnectedState } from "../engine/helpers/reducer/player/setPlayerConnectedState";
import { setPlayerPresence } from "../engine/helpers/reducer/player/presence";
import { touchPlayerActivity } from "../engine/helpers/reducer/player/touchPlayerActivity";
import { normalizeGameId } from "../engine/helpers/reducer/gameId/normalizeGameId";
import { toResult } from "../engine/helpers/reducer/gameState/toResult";
import { deleteConnectionById } from "../engine/helpers/reducer/storage/deleteConnectionById";
import { getConnectionById } from "../engine/helpers/reducer/storage/getConnectionById";
import { getConnectionsByGameId } from "../engine/helpers/reducer/storage/getConnectionsByGameId";
import { getGameById } from "../engine/helpers/reducer/storage/getGameById";
import { putGame } from "../engine/helpers/reducer/storage/putGame";
import { putConnection } from "../engine/helpers/reducer/storage/putConnection";
import { shouldRunAiAfterCompletedTrick } from "./shouldRunAiAfterCompletedTrick";
import {
  assertCheckStatePayload,
  assertCoverAwayPlayerTurnPayload,
  assertCreateGamePayload,
  assertDealCardsPayload,
  assertGetGameStatePayload,
  assertJoinGamePayload,
  assertMovePlayerPayload,
  assertReturnFromAwayPayload,
  assertRenamePlayerPayload,
  assertSendReactionPayload,
  assertSetPlayerAwayPayload,
  assertRemovePlayerPayload,
  assertPlayCardPayload,
  assertRemoveGamePayload,
  assertStartGamePayload,
  assertStartOverPayload,
  assertSubmitBidPayload,
  assertSortCardsPayload,
} from "./validation/lambdaPayload";
import { broadcastGameState, filterLiveConnections, sendSocketResponse } from "./websocket";

const NO_CONTENT_RESPONSE: APIGatewayProxyStructuredResultV2 = { statusCode: 200, body: "" };
const DEFAULT_AI_TURN_DELAY_MS = 1500;
const DEFAULT_TRICK_REVEAL_DELAY_MS = 5000;
const DISCONNECT_GRACE_PERIOD_MS = 5000;

const BROADCAST_ACTIONS = new Set<LambdaEventPayload["action"]>([
  "createGame",
  "joinGame",
  "checkState",
  "dealCards",
  "startGame",
  "startOver",
  "submitBid",
  "playCard",
  "returnFromAway",
  "coverAwayPlayerTurn",
  "sortCards",
  "movePlayer",
  "setPlayerAway",
  "removePlayer",
  "renamePlayer",
  "sendReaction",
  "removeGame",
]);

type SocketRequestBody = {
  requestId?: string;
  action?: unknown;
  payload?: unknown;
};

type ActionResult = {
  response: unknown;
  afterResponse?: () => Promise<void>;
};

type ConnectionAssociationResult = {
  gameId?: string;
  presenceChanged: boolean;
};

const getSocketContext = (event: APIGatewayProxyWebsocketEventV2) => {
  const { connectionId, domainName, stage, routeKey } = event.requestContext;

  if (!connectionId || !domainName || !stage || !routeKey) {
    throw new Error("Missing WebSocket request context");
  }

  return {
    connectionId,
    domainName,
    stage,
    routeKey,
  };
};

const maybeAssociateConnection = async (
  connectionId: string,
  request: LambdaEventPayload,
  result: unknown,
): Promise<ConnectionAssociationResult> => {
  const shouldAssociateConnection =
    request.action !== "checkState" && request.action !== "getGameState"
      ? true
      : Boolean(
          "associateConnection" in request.payload &&
            request.payload.associateConnection === true,
        );
  if (!shouldAssociateConnection) {
    return {
      presenceChanged: false,
    };
  }

  const resultPlayerToken =
    result && typeof result === "object" && "playerToken" in result
      ? (result as { playerToken?: unknown }).playerToken
      : undefined;
  const resultGame =
    result && typeof result === "object" && "game" in result
      ? (result as { game?: { id?: unknown } }).game
      : undefined;
  const gameId =
    typeof resultGame?.id === "string"
      ? resultGame.id
      : "gameId" in request.payload && typeof request.payload.gameId === "string"
        ? request.payload.gameId
        : undefined;
  const playerToken =
    typeof resultPlayerToken === "string"
      ? resultPlayerToken
      : "playerToken" in request.payload && typeof request.payload.playerToken === "string"
        ? request.payload.playerToken
        : undefined;

  if (!gameId || !playerToken) {
    return {
      presenceChanged: false,
    };
  }

  let presenceChanged = false;
  const existingGame = await getGameById(gameId);
  if (existingGame) {
    const playerId = existingGame.playerTokens.find((entry) => entry.token === playerToken)?.playerId;
    if (playerId) {
      const updatedGame = setPlayerConnectedState(existingGame, playerId, true);
      const touchedGame = touchPlayerActivity(updatedGame, playerId, { connected: true });
      if (touchedGame !== existingGame) {
        await putGame(touchedGame);
        presenceChanged = true;
      }
    }
  }

  await putConnection(connectionId, gameId, playerToken);
  return {
    gameId,
    presenceChanged,
  };
};

const maybeBroadcast = async (
  context: ReturnType<typeof getSocketContext>,
  request: LambdaEventPayload,
  result: unknown,
): Promise<void> => {
  if (!BROADCAST_ACTIONS.has(request.action)) {
    return;
  }

  const gameId =
    result && typeof result === "object" && "game" in result
      ? (result as { game?: { id?: unknown } }).game?.id
      : undefined;
  const fallbackGameId =
    "gameId" in request.payload && typeof request.payload.gameId === "string"
      ? request.payload.gameId
      : undefined;
  const resolvedGameId = typeof gameId === "string" ? gameId : fallbackGameId;

  if (!resolvedGameId) {
    return;
  }

  await broadcastGameState(context.domainName, context.stage, resolvedGameId);
};

const handleDefaultRoute = async (
  event: APIGatewayProxyWebsocketEventV2,
): Promise<APIGatewayProxyStructuredResultV2> => {
  const context = getSocketContext(event);
  const body = event.body ? (JSON.parse(event.body) as SocketRequestBody) : {};
  const requestId = typeof body.requestId === "string" && body.requestId.trim()
    ? body.requestId
    : `req-${Date.now()}`;

  try {
    const request = parseLambdaEvent(body.action, body.payload);
    const result = await handleAction(context, request);
    const association = await maybeAssociateConnection(context.connectionId, request, result.response);

    await sendSocketResponse(context.domainName, context.stage, context.connectionId, {
      type: "response",
      requestId,
      ok: true,
      result: result.response,
    });
    await maybeBroadcast(context, request, result.response);
    if (association.presenceChanged && association.gameId && !BROADCAST_ACTIONS.has(request.action)) {
      await broadcastGameState(context.domainName, context.stage, association.gameId);
    }
    await result.afterResponse?.();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unhandled error";
    await sendSocketResponse(context.domainName, context.stage, context.connectionId, {
      type: "response",
      requestId,
      ok: false,
      error: message,
    });
  }

  return NO_CONTENT_RESPONSE;
};

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (
  event,
): Promise<APIGatewayProxyStructuredResultV2> => {
  const context = getSocketContext(event);
  const { routeKey, connectionId } = context;

  switch (routeKey) {
    case "$connect":
      return NO_CONTENT_RESPONSE;
    case "$disconnect":
      await handleDisconnect(context);
      return NO_CONTENT_RESPONSE;
    default:
      return handleDefaultRoute(event);
  }
};

const parseLambdaEvent = (action: unknown, payload: unknown): LambdaEventPayload => {
  if (typeof action !== "string") {
    throw new Error("Missing request action");
  }

  const normalizedPayload =
    payload && typeof payload === "object" && "gameId" in (payload as Record<string, unknown>)
      ? {
          ...(payload as Record<string, unknown>),
          gameId:
            typeof (payload as Record<string, unknown>).gameId === "string"
              ? normalizeGameId((payload as Record<string, unknown>).gameId as string)
              : (payload as Record<string, unknown>).gameId,
        }
      : payload;

  return {
    action: action as LambdaEventPayload["action"],
    payload: normalizedPayload as LambdaEventPayload["payload"],
  } as LambdaEventPayload;
};

type LoadedGameEvent = Exclude<LambdaEventPayload, LambdaEventPayload<"createGame">>;
type AiFollowUpEvent = Exclude<
  LambdaEventPayload,
  LambdaEventPayload<"createGame" | "joinGame">
>;

const reduceLoadedGame = async (event: LoadedGameEvent): Promise<unknown> => {
  const game = await getGameById(event.payload.gameId);
  return engineReducer(game, event);
};

const reduceLoadedGameAndPrepareAi = async (
  context: ReturnType<typeof getSocketContext>,
  event: AiFollowUpEvent,
): Promise<ActionResult> => {
  const game = await getGameById(event.payload.gameId);
  const response = await engineReducer(game, event);
  return {
    response,
    afterResponse: async () => {
      await runAiForGame(context, event.payload.gameId);
    },
  };
};

const handleAction = async (
  context: ReturnType<typeof getSocketContext>,
  event: LambdaEventPayload,
): Promise<ActionResult> => {
  switch (event.action) {
    case "createGame": {
      assertCreateGamePayload(event);
      return { response: await engineReducer(undefined, event) };
    }
    case "removeGame": {
      assertRemoveGamePayload(event);
      return { response: await engineReducer(undefined, event) };
    }
    case "joinGame": {
      assertJoinGamePayload(event);
      return { response: await reduceLoadedGame(event) };
    }
    case "checkState": {
      assertCheckStatePayload(event);
      return { response: await reduceLoadedGame(event) };
    }
    case "dealCards": {
      assertDealCardsPayload(event);
      return reduceLoadedGameAndPrepareAi(context, event);
    }
    case "startGame": {
      assertStartGamePayload(event);
      return reduceLoadedGameAndPrepareAi(context, event);
    }
    case "startOver": {
      assertStartOverPayload(event);
      return { response: await reduceLoadedGame(event) };
    }
    case "submitBid": {
      assertSubmitBidPayload(event);
      return reduceLoadedGameAndPrepareAi(context, event);
    }
    case "playCard": {
      assertPlayCardPayload(event);
      const game = await getGameById(event.payload.gameId);
      await engineReducer(game, event);
      const latestGame = await getGameById(event.payload.gameId);
      if (!latestGame) {
        throw new Error("Game not found");
      }

      const response = toResult(latestGame, undefined, event.payload.playerToken);

      const previousCompletedTrickCount =
        game?.phase && "cards" in game.phase ? game.phase.cards.completedTricks.length : 0;
      const latestCompletedTrickCount =
        latestGame.phase && "cards" in latestGame.phase
          ? latestGame.phase.cards.completedTricks.length
          : 0;
      const trickJustCompleted = latestCompletedTrickCount > previousCompletedTrickCount;

      if (trickJustCompleted) {
        if (shouldRunAiAfterCompletedTrick(latestGame)) {
          const trickRevealDelayMs = getConfiguredDelayMs(
            "TRICK_REVEAL_DELAY_MS",
            DEFAULT_TRICK_REVEAL_DELAY_MS,
          );

          return {
            response,
            afterResponse: async () => {
              await runAiForGame(context, event.payload.gameId, {
                initialDelayMs: trickRevealDelayMs,
              });
            },
          };
        }

        return { response };
      }

      return {
        response,
        afterResponse: async () => {
          await runAiForGame(context, event.payload.gameId);
        },
      };
    }
    case "returnFromAway": {
      assertReturnFromAwayPayload(event);
      return { response: await reduceLoadedGame(event) };
    }
    case "coverAwayPlayerTurn": {
      assertCoverAwayPlayerTurnPayload(event);
      const game = await getGameById(event.payload.gameId);
      const response = await engineReducer(game, event);
      const latestGame = await getGameById(event.payload.gameId);
      const previousCompletedTrickCount =
        game?.phase && "cards" in game.phase ? game.phase.cards.completedTricks.length : 0;
      const latestCompletedTrickCount =
        latestGame?.phase && "cards" in latestGame.phase
          ? latestGame.phase.cards.completedTricks.length
          : 0;
      const trickJustCompleted = latestCompletedTrickCount > previousCompletedTrickCount;

      if (trickJustCompleted) {
        const trickRevealDelayMs = getConfiguredDelayMs(
          "TRICK_REVEAL_DELAY_MS",
          DEFAULT_TRICK_REVEAL_DELAY_MS,
        );

        return {
          response,
          afterResponse: async () => {
            await runAiForGame(context, event.payload.gameId, {
              initialDelayMs: trickRevealDelayMs,
            });
          },
        };
      }

      return {
        response,
        afterResponse: async () => {
          await runAiForGame(context, event.payload.gameId);
        },
      };
    }
    case "sortCards": {
      assertSortCardsPayload(event);
      return { response: await reduceLoadedGame(event) };
    }
    case "movePlayer": {
      assertMovePlayerPayload(event);
      return { response: await reduceLoadedGame(event) };
    }
    case "setPlayerAway": {
      assertSetPlayerAwayPayload(event);
      return { response: await reduceLoadedGame(event) };
    }
    case "removePlayer": {
      assertRemovePlayerPayload(event);
      return reduceLoadedGameAndPrepareAi(context, event);
    }
    case "renamePlayer": {
      assertRenamePlayerPayload(event);
      return { response: await reduceLoadedGame(event) };
    }
    case "sendReaction": {
      assertSendReactionPayload(event);
      return { response: await reduceLoadedGame(event) };
    }
    case "getGameState": {
      assertGetGameStatePayload(event);
      return { response: await engineReducer(undefined, event) };
    }
    default:
      return assertNever(event);
  }
};

const assertNever = (value: never): never => {
  throw new Error(`Unhandled action: ${JSON.stringify(value)}`);
};

const getConfiguredDelayMs = (envName: string, fallbackMs: number): number => {
  const configuredDelay = Number.parseInt(
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[envName] ?? "",
    10,
  );

  return Number.isFinite(configuredDelay) && configuredDelay >= 0
    ? configuredDelay
    : fallbackMs;
};

const handleDisconnect = async (
  context: ReturnType<typeof getSocketContext>,
): Promise<void> => {
  const connection = await getConnectionById(context.connectionId);
  await deleteConnectionById(context.connectionId);

  if (!connection) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, DISCONNECT_GRACE_PERIOD_MS));

  const remainingConnections = await getConnectionsByGameId(connection.gameId);
  const liveRemainingConnections = await filterLiveConnections(
    context.domainName,
    context.stage,
    remainingConnections,
  );
  const stillConnected = liveRemainingConnections.some(
    (entry) => entry.playerToken === connection.playerToken,
  );
  if (stillConnected) {
    return;
  }

  const game = await getGameById(connection.gameId);
  if (!game) {
    return;
  }

  const playerId = game.playerTokens.find((entry) => entry.token === connection.playerToken)?.playerId;
  if (!playerId) {
    return;
  }

  const updatedGame = setPlayerPresence(game, playerId, {
    connected: false,
    away: true,
  });
  if (updatedGame === game) {
    return;
  }

  await putGame(updatedGame);
  await broadcastGameState(context.domainName, context.stage, connection.gameId);
};

const runAiForGame = async (
  context: ReturnType<typeof getSocketContext>,
  gameId: string,
  options: { initialDelayMs?: number } = {},
): Promise<void> => {
  const aiTurnDelayMs = getConfiguredDelayMs("AI_TURN_DELAY_MS", DEFAULT_AI_TURN_DELAY_MS);

  await runAiTurnsForGame(gameId, {
    delayMs: aiTurnDelayMs,
    initialDelayMs: options.initialDelayMs,
    onStep: async () => {
      await broadcastGameState(context.domainName, context.stage, gameId);
    },
  });
};
