import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Game } from "@shared/types/game";
import { requireGame } from "../helpers/reducer/validation/requireGame";

export const playCard = (
  game: Game | undefined,
  _event: LambdaEventPayload<"playCard">,
): Game => requireGame(game);
