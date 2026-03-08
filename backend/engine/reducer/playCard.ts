import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Card, Game, Hand, Trick } from "@shared/types/game";
import { requireGame } from "../helpers/reducer/validation/requireGame";
import { withNextVersion } from "../helpers/reducer/gameState/withNextVersion";

const getNextPlayerId = (playerOrder: string[], playerId: string): string => {
  const currentIndex = playerOrder.indexOf(playerId);
  if (currentIndex < 0) {
    throw new Error("Current player is not in player order");
  }

  return playerOrder[(currentIndex + 1) % playerOrder.length];
};

const removeCardFromHand = (
  hands: Hand[],
  playerId: string,
  cardToRemove: Card,
): Hand[] =>
  hands.map((hand) => {
    if (hand.playerId !== playerId) {
      return hand;
    }

    const cardIndex = hand.cards.findIndex(
      (card) => card.rank === cardToRemove.rank && card.suit === cardToRemove.suit,
    );
    if (cardIndex < 0) {
      throw new Error("Played card not found in current player's hand");
    }

    return {
      ...hand,
      cards: [...hand.cards.slice(0, cardIndex), ...hand.cards.slice(cardIndex + 1)],
    };
  });

export const playCard = (
  game: Game | undefined,
  event: LambdaEventPayload<"playCard">,
): Game => {
  const existingGame = requireGame(game);
  if (existingGame.id !== event.payload.gameId) {
    throw new Error("Game ID mismatch");
  }

  if (existingGame.phase.stage !== "Playing") {
    throw new Error("Cards can only be played during Playing phase");
  }

  const phase = existingGame.phase;
  const turnPlayerId = phase.turnPlayerId;
  const currentTrick: Trick = phase.cards.currentTrick ?? {
    index: phase.trickIndex,
    leadPlayerId: turnPlayerId,
    plays: [],
  };

  if (currentTrick.plays.some((play) => play.playerId === turnPlayerId)) {
    throw new Error("Current player has already played this trick");
  }

  const nextTrick: Trick = {
    ...currentTrick,
    plays: [
      ...currentTrick.plays,
      {
        playerId: turnPlayerId,
        card: event.payload.card,
      },
    ],
  };
  const nextHands = removeCardFromHand(phase.cards.hands, turnPlayerId, event.payload.card);

  const trickComplete = nextTrick.plays.length >= existingGame.playerOrder.length;
  if (!trickComplete) {
    return withNextVersion(existingGame, {
      phase: {
        ...phase,
        turnPlayerId: getNextPlayerId(existingGame.playerOrder, turnPlayerId),
        cards: {
          ...phase.cards,
          hands: nextHands,
          currentTrick: nextTrick,
        },
      },
    });
  }

  const winnerPlayerId = nextTrick.plays[0]?.playerId;
  if (!winnerPlayerId) {
    throw new Error("Cannot complete trick without plays");
  }

  const completedTrick: Trick = {
    ...nextTrick,
    winnerPlayerId,
  };
  const allHandsEmpty = nextHands.every((hand) => hand.cards.length === 0);
  if (allHandsEmpty) {
    const { turnPlayerId: _turnPlayerId, ...scoringPhase } = phase;
    return withNextVersion(existingGame, {
      phase: {
        ...scoringPhase,
        stage: "Scoring",
        trickIndex: phase.trickIndex + 1,
        cards: {
          ...phase.cards,
          hands: nextHands,
          currentTrick: undefined,
          completedTricks: [...phase.cards.completedTricks, completedTrick],
        },
      },
    });
  }

  const nextTrickIndex = phase.trickIndex + 1;
  const nextTurnPlayerId = winnerPlayerId;
  return withNextVersion(existingGame, {
    phase: {
      ...phase,
      trickIndex: nextTrickIndex,
      turnPlayerId: nextTurnPlayerId,
      cards: {
        ...phase.cards,
        hands: nextHands,
        currentTrick: undefined,
        completedTricks: [...phase.cards.completedTricks, completedTrick],
      },
    },
  });
};
