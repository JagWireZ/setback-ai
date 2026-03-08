import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Game } from "@shared/types/game";
import { requireGame } from "../helpers/reducer/validation/requireGame";

export const submitBid = (
  game: Game | undefined,
  _event: LambdaEventPayload<"submitBid">,
): Game => requireGame(game);
