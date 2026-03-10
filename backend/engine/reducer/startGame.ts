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

  const selectedDealerPlayerId = event.payload.dealerPlayerId;
  let nextPlayerOrder = existingGame.playerOrder;

  if (selectedDealerPlayerId) {
    const dealerIndex = existingGame.playerOrder.indexOf(selectedDealerPlayerId);
    if (dealerIndex < 0) {
      throw new Error("Selected dealer is not in player order");
    }

    nextPlayerOrder = [
      ...existingGame.playerOrder.slice(dealerIndex),
      ...existingGame.playerOrder.slice(0, dealerIndex),
    ];
  }

  const nextPhase = advancePhase({
    ...existingGame,
    playerOrder: nextPlayerOrder,
  });

  return withNextVersion(existingGame, {
    playerOrder: nextPlayerOrder,
    phase: nextPhase,
  });
};
