import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Game } from "@shared/types/game";
import { requireGame } from "../helpers/reducer/validation/requireGame";
import { withNextVersion } from "../helpers/reducer/gameState/withNextVersion";

export const renamePlayer = (
  game: Game | undefined,
  event: LambdaEventPayload<"renamePlayer">,
): Game => {
  const existingGame = requireGame(game);
  if (existingGame.id !== event.payload.gameId) {
    throw new Error("Game ID mismatch");
  }

  const playerToken = existingGame.playerTokens.find(
    (entry) => entry.token === event.payload.playerToken,
  );
  if (!playerToken) {
    throw new Error("Invalid player token");
  }

  const nextName = event.payload.playerName.trim();
  if (!nextName) {
    throw new Error("Player name is required");
  }

  return withNextVersion(existingGame, {
    players: existingGame.players.map((player) =>
      player.id === playerToken.playerId
        ? {
            ...player,
            name: nextName,
          }
        : player,
    ),
  });
};
