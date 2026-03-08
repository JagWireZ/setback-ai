import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Game } from "@shared/types/game";
import { requireGame } from "../helpers/reducer/validation/requireGame";

export const disconnectPlayer = (
  game: Game | undefined,
  _event: LambdaEventPayload<"disconnectPlayer">,
): Game => requireGame(game);
