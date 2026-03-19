import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Game } from "@shared/types/game";
import { advanceDueAutomation } from "../ai/reviewGameState";
import { normalizeTurnDueAt } from "../helpers/reducer/gameState/turnTiming";
import { requireGameForAction } from "../helpers/reducer/validation/actionContext";

export const checkState = (
  game: Game | undefined,
  event: LambdaEventPayload<"checkState">,
): Game => {
  const existingGame = requireGameForAction(game, event);

  const normalizedGame = normalizeTurnDueAt(existingGame);
  return advanceDueAutomation(normalizedGame) ?? normalizedGame;
};
