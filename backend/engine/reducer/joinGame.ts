import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Game } from "@shared/types/game";
import { requireGame } from "../helpers/reducer/validation/requireGame";
import { withNextVersion } from "../helpers/reducer/gameState/withNextVersion";

type JoinGameResult = {
  game: Game;
  playerToken: string;
};

export const joinGame = (
  game: Game | undefined,
  event: LambdaEventPayload<"joinGame">,
): JoinGameResult => {
  const existingGame = requireGame(game);
  if (existingGame.id !== event.payload.gameId) {
    throw new Error("Game ID mismatch");
  }

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
