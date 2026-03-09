import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Game } from "@shared/types/game";
import { requireGame } from "../helpers/reducer/validation/requireGame";
import { withNextVersion } from "../helpers/reducer/gameState/withNextVersion";
import { advancePhase } from "../helpers/reducer/gameState/advancePhase";

export const startGame = (
  game: Game | undefined,
  event: LambdaEventPayload<"startGame">,
): Game => {
  const existingGame = requireGame(game);
  if (existingGame.id !== event.payload.gameId) {
    throw new Error("Game ID mismatch");
  }

  if (existingGame.phase.stage !== "Lobby") {
    throw new Error("Game can only be started from Lobby phase");
  }

  const nextPhase = advancePhase({
    ...existingGame,
  });

  return withNextVersion(existingGame, {
    phase: nextPhase,
  });
};
