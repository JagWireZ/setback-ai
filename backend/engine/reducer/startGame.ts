import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Game } from "@shared/types/game";
import { withNextVersion } from "../helpers/reducer/gameState/withNextVersion";
import { advancePhase } from "../helpers/reducer/gameState/advancePhase";
import { generateRounds } from "../helpers/generateRounds";
import { getMaxCardsForSeatCount } from "../helpers/getMaxCardsForSeatCount";
import { requireGameForAction } from "../helpers/reducer/validation/actionContext";

export const startGame = (
  game: Game | undefined,
  event: LambdaEventPayload<"startGame">,
): Game => {
  const existingGame = requireGameForAction(game, event);

  if (existingGame.phase.stage !== "Lobby") {
    throw new Error("Game can only be started from Lobby phase");
  }

  const maxCardsForSeatCount = getMaxCardsForSeatCount(existingGame.playerOrder.length);
  if (event.payload.maxCards > maxCardsForSeatCount) {
    throw new Error(`Max Cards cannot exceed ${maxCardsForSeatCount} with ${existingGame.playerOrder.length} seats`);
  }

  const selectedDealerPlayerId = event.payload.dealerPlayerId;
  const selectedAiDifficulty = event.payload.aiDifficulty ?? existingGame.options.aiDifficulty ?? "medium";
  const rounds = generateRounds(event.payload.maxCards);
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
    options: {
      ...existingGame.options,
      maxCards: event.payload.maxCards,
      aiDifficulty: selectedAiDifficulty,
      rounds,
    },
    playerOrder: nextPlayerOrder,
  });

  return withNextVersion(existingGame, {
    options: {
      ...existingGame.options,
      maxCards: event.payload.maxCards,
      aiDifficulty: selectedAiDifficulty,
      rounds,
    },
    playerOrder: nextPlayerOrder,
    phase: nextPhase,
  });
};
