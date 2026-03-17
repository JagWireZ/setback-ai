import type { Game } from "@shared/types/game";
import { setPlayerPresence } from "./presence";

export const setPlayerConnectedState = (
  game: Game,
  playerId: string,
  connected: boolean,
): Game =>
  setPlayerPresence(game, playerId, {
    connected,
  });
