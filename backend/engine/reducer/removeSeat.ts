import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Game } from "@shared/types/game";
import { requireGame } from "../helpers/reducer/validation/requireGame";
import { withNextVersion } from "../helpers/reducer/gameState/withNextVersion";

export const removeSeat = (
  game: Game | undefined,
  event: LambdaEventPayload<"removeSeat">,
): Game => {
  const existingGame = requireGame(game);
  if (existingGame.id !== event.payload.gameId) {
    throw new Error("Game ID mismatch");
  }

  if (existingGame.phase.stage !== "Lobby") {
    throw new Error("Seats can only be removed in the lobby");
  }

  const targetPlayer = existingGame.players.find((player) => player.id === event.payload.playerId);
  if (!targetPlayer) {
    throw new Error("Player not found");
  }

  if (targetPlayer.type !== "ai") {
    throw new Error("Only AI seats can be removed");
  }

  if (existingGame.playerOrder.length <= 2) {
    throw new Error("Game must keep at least 2 seats");
  }

  return withNextVersion(existingGame, {
    players: existingGame.players.filter((player) => player.id !== targetPlayer.id),
    playerTokens: existingGame.playerTokens.filter((entry) => entry.playerId !== targetPlayer.id),
    playerOrder: existingGame.playerOrder.filter((playerId) => playerId !== targetPlayer.id),
    scores: existingGame.scores.filter((score) => score.playerId !== targetPlayer.id),
  });
};
