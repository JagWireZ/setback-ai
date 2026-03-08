import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Game } from "@shared/types/game";
import { requireGame } from "../helpers/reducer/validation/requireGame";
import { withNextVersion } from "../helpers/reducer/gameState/withNextVersion";

export const setOptions = (
  game: Game | undefined,
  event: LambdaEventPayload<"setOptions">,
): Game => {
  const existingGame = requireGame(game);
  if (existingGame.id !== event.payload.gameId) {
    throw new Error("Game ID mismatch");
  }

  return withNextVersion(existingGame, {
    options: {
      ...existingGame.options,
      maxCards: event.payload.maxCards,
      blindBid: event.payload.blindBid,
    },
  });
};
