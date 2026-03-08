import type { Score } from "@shared/types/game";

export const buildScore = (playerId: string): Score => ({
  playerId,
  total: 0,
  possible: 0,
});
