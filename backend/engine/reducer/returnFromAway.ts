import type { Game } from "@shared/types/game";
import type { LambdaEventPayload } from "@shared/types/lambda";
import { setPlayerPresence } from "../helpers/reducer/player/presence";
import { requirePlayerActionContext } from "../helpers/reducer/validation/actionContext";

export const returnFromAway = (
  game: Game | undefined,
  event: LambdaEventPayload<"returnFromAway">,
): Game => {
  const { game: existingGame, playerId } = requirePlayerActionContext(game, event);

  return setPlayerPresence(existingGame, playerId, {
    connected: true,
    away: false,
    lastSeenAt: Date.now(),
  });
};
