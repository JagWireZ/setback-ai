import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Game } from "@shared/types/game";
import { requireGame } from "../helpers/reducer/validation/requireGame";
import { withNextVersion } from "../helpers/reducer/gameState/withNextVersion";
import { advancePhase } from "../helpers/reducer/gameState/advancePhase";
import { withTurnDueAt } from "../helpers/reducer/gameState/turnTiming";

const getNextPlayerId = (playerOrder: string[], playerId: string): string => {
  const currentIndex = playerOrder.indexOf(playerId);
  if (currentIndex < 0) {
    throw new Error("Current player is not in player order");
  }

  return playerOrder[(currentIndex + 1) % playerOrder.length];
};

export const submitBid = (
  game: Game | undefined,
  event: LambdaEventPayload<"submitBid">,
): Game => {
  const existingGame = requireGame(game);
  if (existingGame.id !== event.payload.gameId) {
    throw new Error("Game ID mismatch");
  }

  if (existingGame.phase.stage !== "Bidding") {
    throw new Error("Bids can only be submitted during Bidding phase");
  }

  const playerToken = existingGame.playerTokens.find(
    (entry) => entry.token === event.payload.playerToken,
  );
  if (!playerToken) {
    throw new Error("Invalid player token");
  }

  const playerId = playerToken.playerId;
  if (playerId !== existingGame.phase.turnPlayerId) {
    throw new Error("It is not this player's turn to bid");
  }

  if (existingGame.phase.bids.some((bid) => bid.playerId === playerId)) {
    throw new Error("Player has already submitted a bid this round");
  }

  const round = existingGame.options.rounds[existingGame.phase.roundIndex];
  if (!round) {
    throw new Error("Round not found for current phase");
  }

  const tripRequested = event.payload.trip === true;
  const canTrip = round.cardCount <= 3;
  if (tripRequested && !canTrip) {
    throw new Error("Trip is only available when cardCount is 3, 2, or 1");
  }

  const amount = tripRequested ? round.cardCount : event.payload.bid;
  if (!Number.isInteger(amount) || amount < 0 || amount > round.cardCount) {
    throw new Error(`Bid must be an integer from 0 to ${round.cardCount}`);
  }

  const nextBids = [
    ...existingGame.phase.bids,
    {
      playerId,
      amount,
      trip: tripRequested,
    },
  ];

  if (nextBids.length < existingGame.playerOrder.length) {
    return withNextVersion(existingGame, {
      phase: withTurnDueAt(existingGame, {
        ...existingGame.phase,
        bids: nextBids,
        turnPlayerId: getNextPlayerId(existingGame.playerOrder, playerId),
        turnStartedAt: Date.now(),
      }),
    });
  }

  const nextPhase = advancePhase({
    ...existingGame,
    phase: {
      ...existingGame.phase,
      bids: nextBids,
    },
  });

  return withNextVersion(existingGame, {
    phase: nextPhase,
  });
};
