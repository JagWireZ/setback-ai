import type { Game } from "@shared/types/game";
import type { LambdaEventPayload } from "@shared/types/lambda";
import { requireGame } from "../helpers/reducer/validation/requireGame";
import { setPlayerPresence } from "../helpers/reducer/player/presence";

export const returnFromAway = (
  game: Game | undefined,
  event: LambdaEventPayload<"returnFromAway">,
): Game => {
  const existingGame = requireGame(game);
  if (existingGame.id !== event.payload.gameId) {
    throw new Error("Game ID mismatch");
  }

  const playerId = existingGame.playerTokens.find(
    (entry) => entry.token === event.payload.playerToken,
  )?.playerId;
  if (!playerId) {
    throw new Error("Invalid player token");
  }

  return setPlayerPresence(existingGame, playerId, {
    connected: true,
    away: false,
    lastSeenAt: Date.now(),
  });
};
