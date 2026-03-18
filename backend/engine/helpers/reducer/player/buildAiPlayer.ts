import type { Player } from "@shared/types/game";
import { buildPlayer } from "./buildPlayer";

export const buildAiPlayer = (name: string): Player => ({
  ...buildPlayer(name),
  type: "ai",
});
