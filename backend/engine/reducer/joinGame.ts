import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Game } from "@shared/types/game";
import { withNextVersion } from "../helpers/reducer/gameState/withNextVersion";
import { requireGameForAction } from "../helpers/reducer/validation/actionContext";

type JoinGameResult = {
  game: Game;
  playerToken: string;
};

export const joinGame = (
  game: Game | undefined,
  event: LambdaEventPayload<"joinGame">,
): JoinGameResult => {
  const existingGame = requireGameForAction(game, event);

  const aiPlayerToJoin = existingGame.players.find((player) => player.type === "ai");
  if (!aiPlayerToJoin) {
    throw new Error("Game is full");
  }

  const nextPlayerToken = existingGame.playerTokens.find(
    (entry) => entry.playerId === aiPlayerToJoin.id,
  );
  if (!nextPlayerToken) {
    throw new Error("Missing player token for AI player");
  }

  const updatedGame = withNextVersion(existingGame, {
    players: existingGame.players.map((player) =>
      player.id === aiPlayerToJoin.id
        ? {
            ...player,
            name: event.payload.playerName,
            type: "human",
            presence: {
              connected: true,
              lastSeenAt: Date.now(),
              away: false,
            },
            controller: "human",
          }
        : player,
    ),
  });

  return {
    game: updatedGame,
    playerToken: nextPlayerToken.token,
  };
};
