import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Game } from "@shared/types/game";
import { pruneActiveReactions } from "../helpers/reducer/gameState/reactions";
import { withNextVersion } from "../helpers/reducer/gameState/withNextVersion";
import { requireGame } from "../helpers/reducer/validation/requireGame";

export const sendReaction = (
  game: Game | undefined,
  event: LambdaEventPayload<"sendReaction">,
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

  const now = Date.now();
  const nextReaction = {
    id: `${playerToken.playerId}-${now}`,
    playerId: playerToken.playerId,
    emoji: event.payload.emoji,
    createdAt: now,
  };

  return withNextVersion(existingGame, {
    reactions: pruneActiveReactions([...(existingGame.reactions ?? []), nextReaction], now),
  });
};
