import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Game } from "@shared/types/game";
import { requireGame } from "../helpers/reducer/validation/requireGame";
import { advanceDueAutomation } from "../ai/reviewGameState";
import { normalizeTurnDueAt } from "../helpers/reducer/gameState/turnTiming";

export const checkState = (
  game: Game | undefined,
  event: LambdaEventPayload<"checkState">,
): Game => {
  const existingGame = requireGame(game);
  if (existingGame.id !== event.payload.gameId) {
    throw new Error("Game ID mismatch");
  }

  const normalizedGame = normalizeTurnDueAt(existingGame);
  return advanceDueAutomation(normalizedGame) ?? normalizedGame;
};
