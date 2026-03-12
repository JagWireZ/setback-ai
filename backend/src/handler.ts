import { LambdaFunctionURLEvent, LambdaFunctionURLResult } from "aws-lambda";
import type { LambdaEventPayload } from "@shared/types/lambda";
import { engineReducer } from "../engine";
import { runAiTurnsForGame } from "../engine/ai/runAiTurnsForGame";
import { toResult } from "../engine/helpers/reducer/gameState/toResult";
import { getGameById } from "../engine/helpers/reducer/storage/getGameById";
import {
  assertCheckStatePayload,
  assertCreateGamePayload,
  assertDealCardsPayload,
  assertGetGameStatePayload,
  assertJoinGamePayload,
  assertMovePlayerPayload,
  assertRenamePlayerPayload,
  assertRemovePlayerPayload,
  assertPlayCardPayload,
  assertRemoveGamePayload,
  assertStartGamePayload,
  assertStartOverPayload,
  assertSubmitBidPayload,
  assertSortCardsPayload,
} from "./validation/lambdaPayload";

export const handler = async (
  event: LambdaFunctionURLEvent
): Promise<LambdaFunctionURLResult> => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { action, payload } = body;

    const request = parseLambdaEvent(action, payload);
    const result = await handleAction(request);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(result),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unhandled error";
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: message }),
    };
  }
};

const parseLambdaEvent = (action: unknown, payload: unknown): LambdaEventPayload => {
  if (typeof action !== "string") {
    throw new Error("Missing request action");
  }

  return {
    action: action as LambdaEventPayload["action"],
    payload: payload as LambdaEventPayload["payload"],
  } as LambdaEventPayload;
};

const handleAction = async (
  event: LambdaEventPayload,
): Promise<unknown> => {
  switch (event.action) {
    case "createGame": {
      assertCreateGamePayload(event);
      return engineReducer(undefined, event);
    }
    case "removeGame": {
      assertRemoveGamePayload(event);
      return engineReducer(undefined, event);
    }
    case "joinGame": {
      assertJoinGamePayload(event);
      const game = await getGameById(event.payload.gameId);
      return engineReducer(game, event);
    }
    case "checkState": {
      assertCheckStatePayload(event);
      const game = await getGameById(event.payload.gameId);
      return engineReducer(game, event);
    }
    case "dealCards": {
      assertDealCardsPayload(event);
      const game = await getGameById(event.payload.gameId);
      await engineReducer(game, event);
      return runAiAndReturnForViewer(event.payload.gameId, event.payload.playerToken);
    }
    case "startGame": {
      assertStartGamePayload(event);
      const game = await getGameById(event.payload.gameId);
      await engineReducer(game, event);
      return runAiAndReturnForViewer(event.payload.gameId, event.payload.playerToken);
    }
    case "startOver": {
      assertStartOverPayload(event);
      const game = await getGameById(event.payload.gameId);
      return engineReducer(game, event);
    }
    case "submitBid": {
      assertSubmitBidPayload(event);
      const game = await getGameById(event.payload.gameId);
      await engineReducer(game, event);
      return runAiAndReturnForViewer(event.payload.gameId, event.payload.playerToken);
    }
    case "playCard": {
      assertPlayCardPayload(event);
      const game = await getGameById(event.payload.gameId);
      await engineReducer(game, event);
      const latestGame = await getGameById(event.payload.gameId);
      if (!latestGame) {
        throw new Error("Game not found");
      }

      const previousCompletedTrickCount =
        game?.phase && "cards" in game.phase ? game.phase.cards.completedTricks.length : 0;
      const latestCompletedTrickCount =
        latestGame.phase && "cards" in latestGame.phase
          ? latestGame.phase.cards.completedTricks.length
          : 0;
      const trickJustCompleted = latestCompletedTrickCount > previousCompletedTrickCount;

      if (trickJustCompleted) {
        return toResult(latestGame, undefined, event.payload.playerToken);
      }

      return runAiAndReturnForViewer(event.payload.gameId, event.payload.playerToken);
    }
    case "sortCards": {
      assertSortCardsPayload(event);
      const game = await getGameById(event.payload.gameId);
      return engineReducer(game, event);
    }
    case "movePlayer": {
      assertMovePlayerPayload(event);
      const game = await getGameById(event.payload.gameId);
      return engineReducer(game, event);
    }
    case "removePlayer": {
      assertRemovePlayerPayload(event);
      const game = await getGameById(event.payload.gameId);
      return engineReducer(game, event);
    }
    case "renamePlayer": {
      assertRenamePlayerPayload(event);
      const game = await getGameById(event.payload.gameId);
      return engineReducer(game, event);
    }
    case "getGameState": {
      assertGetGameStatePayload(event);
      return engineReducer(undefined, event);
    }
    default:
      return assertNever(event);
  }
};

const assertNever = (value: never): never => {
  throw new Error(`Unhandled action: ${JSON.stringify(value)}`);
};

const runAiAndReturnForViewer = async (
  gameId: string,
  viewerPlayerToken: string,
): Promise<unknown> => {
  await runAiTurnsForGame(gameId);
  const latestGame = await getGameById(gameId);
  if (!latestGame) {
    throw new Error("Game not found");
  }

  return toResult(latestGame, undefined, viewerPlayerToken);
};
