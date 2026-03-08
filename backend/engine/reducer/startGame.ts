import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Game } from "@shared/types/game";
import { requireGame } from "../helpers/reducer/requireGame";
import { withNextVersion } from "../helpers/reducer/withNextVersion";
import { generateRounds } from "../helpers/generateRounds";

export const startGame = (
  game: Game | undefined,
  event: LambdaEventPayload<"startGame">,
): Game => {
  const existingGame = requireGame(game);
  if (existingGame.id !== event.payload.gameId) {
    throw new Error("Game ID mismatch");
  }

  return withNextVersion(existingGame, {
    options: {
      ...existingGame.options,
      rounds: generateRounds(existingGame.options.maxCards),
    },
  });
};
