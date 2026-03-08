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

  return withNextVersion(existingGame, {
    players: existingGame.players.filter((player) => player.id !== event.payload.playerId),
    playerTokens: existingGame.playerTokens.filter(
      (playerToken) => playerToken.playerId !== event.payload.playerId,
    ),
    playerOrder: existingGame.playerOrder.filter((playerId) => playerId !== event.payload.playerId),
    scores: existingGame.scores.filter((score) => score.playerId !== event.payload.playerId),
  });
};
