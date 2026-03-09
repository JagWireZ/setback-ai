import { LambdaFunctionURLEvent, LambdaFunctionURLResult } from "aws-lambda";
import type { LambdaEventPayload } from "@shared/types/lambda";
import { engineReducer } from "../engine";
import { getGameById } from "../engine/helpers/reducer/storage/getGameById";
import {
  assertCreateGamePayload,
  assertDealCardsPayload,
  assertJoinGamePayload,
  assertRemoveGamePayload,
  assertStartGamePayload,
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
    case "dealCards": {
      assertDealCardsPayload(event);
      const game = await getGameById(event.payload.gameId);
      return engineReducer(game, event);
    }
    case "startGame": {
      assertStartGamePayload(event);
      const game = await getGameById(event.payload.gameId);
      return engineReducer(game, event);
    }
    case "submitBid":
    case "playCard":
    case "movePlayer":
    case "getGameState":
      return {
        action: event.action,
        ok: true,
      };
    default:
      return assertNever(event);
  }
};

const assertNever = (value: never): never => {
  throw new Error(`Unhandled action: ${JSON.stringify(value)}`);
};
