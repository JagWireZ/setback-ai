import type { Game } from "@shared/types/game";
import { touchPlayerPresence } from "./presence";

export const touchPlayerActivity = (
  game: Game,
  playerId: string,
  options: { connected?: boolean; nowMs?: number } = {},
): Game =>
  touchPlayerPresence(game, playerId, {
    ...(typeof options.connected === "boolean" ? { connected: options.connected } : {}),
    lastSeenAt: options.nowMs,
  });
