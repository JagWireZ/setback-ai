import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { LambdaEventPayload } from "@shared/types/lambda";

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const request = parseLambdaEvent(event);
  const result = await handleAction(request);

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(result),
  };
};

const parseLambdaEvent = (event: APIGatewayProxyEvent): LambdaEventPayload => {
  if (!event.body) {
    throw new Error("Missing request body");
  }

  return JSON.parse(event.body) as LambdaEventPayload;
};

const handleAction = async (
  event: LambdaEventPayload,
): Promise<{ action: LambdaEventPayload["action"]; ok: true }> => {
  switch (event.action) {
    case "createGame":
    case "joinGame":
    case "setOptions":
    case "startGame":
    case "dealCards":
    case "submitBid":
    case "playCard":
    case "movePlayer":
    case "removePlayer":
    case "reconnectPlayer":
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
