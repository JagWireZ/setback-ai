import type { Reaction } from "@shared/types/game";

export const REACTION_COOLDOWN_MS = 5000;
export const REACTION_TTL_MS = 5000;
const MAX_REACTIONS = 20;

export const pruneActiveReactions = (
  reactions: Reaction[] | undefined,
  now = Date.now(),
): Reaction[] =>
  (reactions ?? [])
    .filter((reaction) => now - reaction.createdAt < REACTION_TTL_MS)
    .slice(-MAX_REACTIONS);
