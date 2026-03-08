import type { PlayerToken } from "@shared/types/game";
import { generatePlayerToken } from "../../generatePlayerToken";

export const buildPlayerToken = (playerId: string): PlayerToken => ({
  playerId,
  token: generatePlayerToken(),
});
