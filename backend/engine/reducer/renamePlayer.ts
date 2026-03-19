import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Game } from "@shared/types/game";
import { requireOwnerToken } from "../helpers/reducer/validation/requireOwnerToken";
import { withNextVersion } from "../helpers/reducer/gameState/withNextVersion";
import { requirePlayerActionContext } from "../helpers/reducer/validation/actionContext";

export const renamePlayer = (
  game: Game | undefined,
  event: LambdaEventPayload<"renamePlayer">,
): Game => {
  const { game: existingGame, playerId } = requirePlayerActionContext(game, event);

  const targetPlayerId = event.payload.playerId ?? playerId;
  if (targetPlayerId !== playerId) {
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
