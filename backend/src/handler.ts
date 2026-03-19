import {
  APIGatewayProxyWebsocketEventV2,
  APIGatewayProxyWebsocketHandlerV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import type { Game } from "@shared/types/game";
import type { LambdaAction, LambdaEventPayload } from "@shared/types/lambda";
import { engineReducer } from "../engine";
import { runAiTurnsForGame } from "../engine/ai/runAiTurnsForGame";
import { setPlayerConnectedState } from "../engine/helpers/reducer/player/setPlayerConnectedState";
import { setPlayerPresence } from "../engine/helpers/reducer/player/presence";
import { touchPlayerActivity } from "../engine/helpers/reducer/player/touchPlayerActivity";
import { normalizeGameId } from "../engine/helpers/reducer/gameId/normalizeGameId";
import { toResult } from "../engine/helpers/reducer/gameState/toResult";
import { isAutomatedTurnPlayer, isTurnPhase, setCurrentTurnDueAt } from "../engine/helpers/reducer/gameState/turnTiming";
import { deleteConnectionById } from "../engine/helpers/reducer/storage/deleteConnectionById";
import { getConnectionById } from "../engine/helpers/reducer/storage/getConnectionById";
import { getConnectionsByGameId } from "../engine/helpers/reducer/storage/getConnectionsByGameId";
import { getGameById } from "../engine/helpers/reducer/storage/getGameById";
import { putGame } from "../engine/helpers/reducer/storage/putGame";
import { putConnection } from "../engine/helpers/reducer/storage/putConnection";
import { shouldRunAiAfterCompletedTrick } from "./shouldRunAiAfterCompletedTrick";
import { validateLambdaPayload } from "./validation/lambdaPayload";
import { broadcastGameState, filterLiveConnections, sendSocketResponse } from "./websocket";

const NO_CONTENT_RESPONSE: APIGatewayProxyStructuredResultV2 = { statusCode: 200, body: "" };
const DEFAULT_TRICK_REVEAL_DELAY_MS = 5000;
const DISCONNECT_GRACE_PERIOD_MS = 5000;

const BROADCAST_ACTIONS = new Set<LambdaEventPayload["action"]>([
  "createGame",
  "joinGame",
  "checkState",
  "addSeat",
  "removeSeat",
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

type SocketContext = ReturnType<typeof getSocketContext>;
type ActionExecutor = (
  context: SocketContext,
  event: LambdaEventPayload,
) => Promise<ActionResult>;
type TurnActionEvent = LambdaEventPayload<"playCard" | "coverAwayPlayerTurn">;
type TurnActionOptions = {
  responseMode: "reducer" | "latestGame";
  completedTrickResponseMode?: "reducer" | "latestGame";
  shouldRunAiAfterCompletedTrick?: (game: Game) => boolean;
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
  context: SocketContext,
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

    try {
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
    } catch (deliveryError) {
      console.error("WebSocket delivery failed after successful action", deliveryError);
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
  const { routeKey } = context;

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
  context: SocketContext,
  event: AiFollowUpEvent,
): Promise<ActionResult> => {
  const response = await reduceLoadedGame(event);
  return {
    response,
    afterResponse: async () => {
      await runAiForGame(context, event.payload.gameId);
    },
  };
};

const withCurrentAiTurnDelay = async (
  game: Game,
  delayMs: number,
): Promise<Game> => {
  if (!isTurnPhase(game.phase) || !isAutomatedTurnPlayer(game, game.phase.turnPlayerId)) {
    return game;
  }

  const delayedGame = setCurrentTurnDueAt(game, Date.now() + delayMs);
  if (delayedGame !== game) {
    await putGame(delayedGame);
  }

  return delayedGame;
};

const getCompletedTrickCount = (game: Game | undefined): number =>
  game?.phase && "cards" in game.phase ? game.phase.cards.completedTricks.length : 0;

const toViewerResponse = (
  game: Game | undefined,
  playerToken: string,
  fallbackResponse: unknown,
): unknown => (game ? toResult(game, undefined, playerToken) : fallbackResponse);

const executeTurnAction = async (
  context: SocketContext,
  event: TurnActionEvent,
  options: TurnActionOptions,
): Promise<ActionResult> => {
  const game = await getGameById(event.payload.gameId);
  const response = await engineReducer(game, event);
  let latestGame = await getGameById(event.payload.gameId);
  const trickJustCompleted =
    getCompletedTrickCount(latestGame) > getCompletedTrickCount(game);
  const responseMode = trickJustCompleted
    ? (options.completedTrickResponseMode ?? options.responseMode)
    : options.responseMode;

  if (trickJustCompleted) {
    const shouldRunAi = latestGame
      ? (options.shouldRunAiAfterCompletedTrick?.(latestGame) ?? true)
      : true;

    if (!shouldRunAi) {
      return {
        response: responseMode === "latestGame"
          ? toViewerResponse(latestGame, event.payload.playerToken, response)
          : response,
      };
    }

    const trickRevealDelayMs = getConfiguredDelayMs(
      "TRICK_REVEAL_DELAY_MS",
      DEFAULT_TRICK_REVEAL_DELAY_MS,
    );
    if (latestGame) {
      latestGame = await withCurrentAiTurnDelay(latestGame, trickRevealDelayMs);
    }

    return {
      response: responseMode === "latestGame"
        ? toViewerResponse(latestGame, event.payload.playerToken, response)
        : response,
      afterResponse: async () => {
        await runAiForGame(context, event.payload.gameId);
      },
    };
  }

  return {
    response: options.responseMode === "latestGame"
      ? toViewerResponse(latestGame, event.payload.playerToken, response)
      : response,
    afterResponse: async () => {
      await runAiForGame(context, event.payload.gameId);
    },
  };
};

const ACTION_EXECUTORS: Record<LambdaAction, ActionExecutor> = {
  createGame: async (_context, event) => ({
    response: await engineReducer(undefined, event as LambdaEventPayload<"createGame">),
  }),
  joinGame: async (_context, event) => ({
    response: await reduceLoadedGame(event as LoadedGameEvent),
  }),
  checkState: async (_context, event) => ({
    response: await reduceLoadedGame(event as LoadedGameEvent),
  }),
  addSeat: async (_context, event) => ({
    response: await reduceLoadedGame(event as LoadedGameEvent),
  }),
  removeSeat: async (_context, event) => ({
    response: await reduceLoadedGame(event as LoadedGameEvent),
  }),
  startGame: async (context, event) =>
    reduceLoadedGameAndPrepareAi(context, event as AiFollowUpEvent),
  startOver: async (_context, event) => ({
    response: await reduceLoadedGame(event as LoadedGameEvent),
  }),
  dealCards: async (context, event) =>
    reduceLoadedGameAndPrepareAi(context, event as AiFollowUpEvent),
  submitBid: async (context, event) =>
    reduceLoadedGameAndPrepareAi(context, event as AiFollowUpEvent),
  playCard: async (context, event) =>
    executeTurnAction(context, event as TurnActionEvent, {
      responseMode: "latestGame",
      shouldRunAiAfterCompletedTrick: shouldRunAiAfterCompletedTrick,
    }),
  returnFromAway: async (_context, event) => ({
    response: await reduceLoadedGame(event as LoadedGameEvent),
  }),
  coverAwayPlayerTurn: async (context, event) =>
    executeTurnAction(context, event as TurnActionEvent, {
      responseMode: "reducer",
      completedTrickResponseMode: "latestGame",
    }),
  sortCards: async (_context, event) => ({
    response: await reduceLoadedGame(event as LoadedGameEvent),
  }),
  movePlayer: async (_context, event) => ({
    response: await reduceLoadedGame(event as LoadedGameEvent),
  }),
  setPlayerAway: async (_context, event) => ({
    response: await reduceLoadedGame(event as LoadedGameEvent),
  }),
  removePlayer: async (context, event) =>
    reduceLoadedGameAndPrepareAi(context, event as AiFollowUpEvent),
  renamePlayer: async (_context, event) => ({
    response: await reduceLoadedGame(event as LoadedGameEvent),
  }),
  sendReaction: async (_context, event) => ({
    response: await reduceLoadedGame(event as LoadedGameEvent),
  }),
  removeGame: async (_context, event) => ({
    response: await engineReducer(undefined, event as LambdaEventPayload<"removeGame">),
  }),
  getGameState: async (_context, event) => ({
    response: await engineReducer(undefined, event as LambdaEventPayload<"getGameState">),
  }),
};

const handleAction = async (
  context: SocketContext,
  event: LambdaEventPayload,
): Promise<ActionResult> => {
  const validatedEvent = validateLambdaPayload(event);
  return ACTION_EXECUTORS[validatedEvent.action](context, validatedEvent);
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
  context: SocketContext,
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
  context: SocketContext,
  gameId: string,
): Promise<void> => {
  await runAiTurnsForGame(gameId, {
    onStep: async () => {
      await broadcastGameState(context.domainName, context.stage, gameId);
    },
  });
};
