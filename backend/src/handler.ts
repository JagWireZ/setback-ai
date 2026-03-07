import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { Game } from "@shared/types/game";

export const handler = async (
  _event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const game: Game = {
    id: "demo-game",
    options: { maxCards: 10 },
    players: [],
    scores: [],
  };

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: "Hello from TypeScript Lambda!",
      gameId: game.id,
      timestamp: new Date().toISOString(),
    }),
  };
};
