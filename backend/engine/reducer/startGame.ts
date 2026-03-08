import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Game } from "@shared/types/game";
import { requireGame } from "../helpers/reducer/validation/requireGame";
import { withNextVersion } from "../helpers/reducer/gameState/withNextVersion";
import { generateRounds } from "../helpers/generateRounds";
import { advancePhase } from "../helpers/reducer/gameState/advancePhase";

export const startGame = (
  game: Game | undefined,
  event: LambdaEventPayload<"startGame">,
): Game => {
  const existingGame = requireGame(game);
  if (existingGame.id !== event.payload.gameId) {
    throw new Error("Game ID mismatch");
  }

  const rounds = generateRounds(existingGame.options.maxCards);
  const nextPhase = advancePhase({
    ...existingGame,
    options: {
      ...existingGame.options,
      rounds,
    },
  });

  return withNextVersion(existingGame, {
    options: {
      ...existingGame.options,
      rounds,
    },
    phase: nextPhase,
  });
};
