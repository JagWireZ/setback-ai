import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Game } from "@shared/types/game";
import { requireGame } from "../helpers/reducer/validation/requireGame";
import { withNextVersion } from "../helpers/reducer/gameState/withNextVersion";

export const removePlayer = (
  game: Game | undefined,
  event: LambdaEventPayload<"removePlayer">,
): Game => {
  const existingGame = requireGame(game);
  if (existingGame.id !== event.payload.gameId) {
    throw new Error("Game ID mismatch");
  }

  const targetPlayer = existingGame.players.find((player) => player.id === event.payload.playerId);
  if (!targetPlayer) {
    throw new Error("Player not found");
  }

  const ownerPlayer = existingGame.playerTokens.find(
    (playerToken) => playerToken.token === existingGame.ownerToken,
  );
  if (!ownerPlayer) {
    throw new Error("Owner player not found");
  }

  if (targetPlayer.id === ownerPlayer.playerId) {
    throw new Error("Owner player cannot be removed");
  }

  if (targetPlayer.type === "ai") {
    return existingGame;
  }

  const playerIndex = existingGame.players.findIndex((player) => player.id === targetPlayer.id);
  const aiName = `AI ${playerIndex + 1}`;

  return withNextVersion(existingGame, {
    players: existingGame.players.map((player) =>
      player.id === targetPlayer.id
        ? {
            ...player,
            name: aiName,
            type: "ai",
            connected: true,
          }
        : player,
    ),
  });
};
