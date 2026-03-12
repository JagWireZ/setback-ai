import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Game } from "@shared/types/game";
import { requireOwnerToken } from "../helpers/reducer/validation/requireOwnerToken";
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

  const targetPlayerId = event.payload.playerId ?? playerToken.playerId;
  if (targetPlayerId !== playerToken.playerId) {
    requireOwnerToken(existingGame, event.payload.playerToken);
  }

  const targetPlayer = existingGame.players.find((player) => player.id === targetPlayerId);
  if (!targetPlayer) {
    throw new Error("Player not found");
  }

  const nextName = event.payload.playerName.trim();
  if (!nextName) {
    throw new Error("Player name is required");
  }

  return withNextVersion(existingGame, {
    players: existingGame.players.map((player) =>
      player.id === targetPlayer.id
        ? {
            ...player,
            name: nextName,
          }
        : player,
    ),
  });
};
