import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Game } from "@shared/types/game";
import {
  REACTION_COOLDOWN_MS,
  pruneActiveReactions,
} from "../helpers/reducer/gameState/reactions";
import { withNextVersion } from "../helpers/reducer/gameState/withNextVersion";
import { requirePlayerActionContext } from "../helpers/reducer/validation/actionContext";

export const sendReaction = (
  game: Game | undefined,
  event: LambdaEventPayload<"sendReaction">,
): Game => {
  const { game: existingGame, playerId } = requirePlayerActionContext(game, event);

  const now = Date.now();
  const activeReactions = pruneActiveReactions(existingGame.reactions ?? [], now);
  const lastPlayerReaction = [...activeReactions]
    .reverse()
    .find((reaction) => reaction.playerId === playerId);

  if (lastPlayerReaction && now - lastPlayerReaction.createdAt < REACTION_COOLDOWN_MS) {
    return existingGame;
  }

  const nextReaction = {
    id: `${playerId}-${now}`,
    playerId,
    ...(event.payload.emoji ? { emoji: event.payload.emoji } : {}),
    ...(event.payload.phrase ? { phrase: event.payload.phrase } : {}),
    createdAt: now,
  };

  return withNextVersion(existingGame, {
    reactions: pruneActiveReactions([...activeReactions, nextReaction], now),
  });
};
