import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Game } from "@shared/types/game";
import {
  REACTION_COOLDOWN_MS,
  pruneActiveReactions,
} from "../helpers/reducer/gameState/reactions";
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
  const activeReactions = pruneActiveReactions(existingGame.reactions ?? [], now);
  const lastPlayerReaction = [...activeReactions]
    .reverse()
    .find((reaction) => reaction.playerId === playerToken.playerId);

  if (lastPlayerReaction && now - lastPlayerReaction.createdAt < REACTION_COOLDOWN_MS) {
    return existingGame;
  }

  const nextReaction = {
    id: `${playerToken.playerId}-${now}`,
    playerId: playerToken.playerId,


















































    ...(event.payload.emoji ? { emoji: event.payload.emoji } : {}),
    ...(event.payload.phrase ? { phrase: event.payload.phrase } : {}),
    createdAt: now,
  };

  return withNextVersion(existingGame, {
    reactions: pruneActiveReactions([...activeReactions, nextReaction], now),
  });
};
