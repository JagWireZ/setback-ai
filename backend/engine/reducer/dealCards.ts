import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Card, Game } from "@shared/types/game";
import { requireGame } from "../helpers/reducer/validation/requireGame";
import { shuffleCards } from "../helpers/shuffleCards";
import { withNextVersion } from "../helpers/reducer/gameState/withNextVersion";
import { advancePhase } from "../helpers/reducer/gameState/advancePhase";

const getNextPlayerIndex = (playerOrder: string[], playerId: string): number => {
  const currentIndex = playerOrder.indexOf(playerId);
  if (currentIndex < 0) {
    throw new Error("Player is not in player order");
  }

  return (currentIndex + 1) % playerOrder.length;
};

export const dealCards = (
  game: Game | undefined,
  event: LambdaEventPayload<"dealCards">,
): Game => {
  const existingGame = requireGame(game);
  if (existingGame.id !== event.payload.gameId) {
    throw new Error("Game ID mismatch");
  }

  if (existingGame.phase.stage !== "Dealing") {
    throw new Error("Cards can only be dealt during Dealing phase");
  }

  const playerToken = existingGame.playerTokens.find(
    (entry) => entry.token === event.payload.playerToken,
  );
  if (!playerToken) {
    throw new Error("Invalid player token");
  }

  if (playerToken.playerId !== existingGame.phase.dealerPlayerId) {
    throw new Error("Only the dealer can deal cards");
  }

  if (playerToken.playerId !== existingGame.phase.turnPlayerId) {
    throw new Error("Only the active turn player can deal cards");
  }

  if (existingGame.playerOrder.length === 0) {
    throw new Error("Cannot deal cards without players");
  }

  const round = existingGame.options.rounds[existingGame.phase.roundIndex];
  if (!round) {
    throw new Error("Round not found for current phase");
  }

  const deck = shuffleCards();
  const handsByPlayerId = new Map<string, Card[]>(
    existingGame.playerOrder.map((playerId) => [playerId, []]),
  );
  const firstPlayerIndex = getNextPlayerIndex(existingGame.playerOrder, existingGame.phase.dealerPlayerId);

  for (let cardNumber = 0; cardNumber < round.cardCount; cardNumber += 1) {
    for (let playerOffset = 0; playerOffset < existingGame.playerOrder.length; playerOffset += 1) {
      const playerId =
        existingGame.playerOrder[
          (firstPlayerIndex + playerOffset) % existingGame.playerOrder.length
        ];
      const nextCard = deck.shift();
      if (!nextCard) {
        throw new Error("Not enough cards to complete dealing");
      }
      const hand = handsByPlayerId.get(playerId);
      if (!hand) {
        throw new Error("Missing hand while dealing");
      }
      hand.push(nextCard);
    }
  }

  let trump = deck.shift();
  if (!trump) {
    throw new Error("No cards left to reveal trump");
  }

  while (trump.suit === "Joker") {
    deck.push(trump);
    trump = deck.shift();
    if (!trump) {
      throw new Error("Unable to reveal a non-joker trump card");
    }
  }

  const dealtPhase = {
    ...existingGame.phase,
    trickIndex: 0,
    bids: [],
    cards: {
      ...existingGame.phase.cards,
      deck,
      trump,
      trumpBroken: false,
      hands: existingGame.playerOrder.map((playerId) => ({
        playerId,
        cards: handsByPlayerId.get(playerId) ?? [],
      })),
      currentTrick: undefined,
      completedTricks: [],
    },
  };

  const nextPhase = advancePhase({
    ...existingGame,
    phase: dealtPhase,
  });

  return withNextVersion(existingGame, {
    phase: nextPhase,
  });
};
