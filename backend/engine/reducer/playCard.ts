import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Card, Game, Hand, Suit, Trick, TrickPlay } from "@shared/types/game";
import { requireGame } from "../helpers/reducer/validation/requireGame";
import { withNextVersion } from "../helpers/reducer/gameState/withNextVersion";
import { advancePhase } from "../helpers/reducer/gameState/advancePhase";
import { scoreRound } from "../helpers/reducer/gameState/scoreRound";
import { withTurnDueAt } from "../helpers/reducer/gameState/turnTiming";

const END_OF_ROUND_DELAY_MS = 10000;

const RANK_VALUE: Record<string, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

const getNextPlayerId = (playerOrder: string[], playerId: string): string => {
  const currentIndex = playerOrder.indexOf(playerId);
  if (currentIndex < 0) {
    throw new Error("Current player is not in player order");
  }

  return playerOrder[(currentIndex + 1) % playerOrder.length];
};

const getNormalizedSuit = (card: Card, trumpSuit: Suit): Suit =>
  card.suit === "Joker" ? trumpSuit : card.suit;

const isTrumpCard = (card: Card, trumpSuit: Suit): boolean =>
  getNormalizedSuit(card, trumpSuit) === trumpSuit;

const hasSuit = (cards: Card[], suit: Suit, trumpSuit: Suit): boolean =>
  cards.some((card) => getNormalizedSuit(card, trumpSuit) === suit);

const canLeadTrump = (cards: Card[], trumpSuit: Suit, trumpBroken: boolean): boolean => {
  if (trumpBroken) {
    return true;
  }

  return cards.every((card) => isTrumpCard(card, trumpSuit));
};

const getPlayStrength = (
  play: TrickPlay,
  leadSuit: Suit,
  trumpSuit: Suit,
): { tier: number; rank: number } => {
  if (play.card.rank === "BJ") {
    return { tier: 4, rank: 100 };
  }

  if (play.card.rank === "LJ") {
    return { tier: 3, rank: 100 };
  }

  const normalizedSuit = getNormalizedSuit(play.card, trumpSuit);
  if (normalizedSuit === trumpSuit) {
    return { tier: 2, rank: RANK_VALUE[play.card.rank] ?? 0 };
  }

  if (normalizedSuit === leadSuit) {
    return { tier: 1, rank: RANK_VALUE[play.card.rank] ?? 0 };
  }

  return { tier: 0, rank: RANK_VALUE[play.card.rank] ?? 0 };
};

const resolveTrickWinner = (trick: Trick, trumpSuit: Suit): string => {
  if (trick.plays.length === 0) {
    throw new Error("Cannot resolve trick winner without plays");
  }

  const leadSuit = getNormalizedSuit(trick.plays[0].card, trumpSuit);
  const winningPlay = trick.plays.reduce((best, current) => {
    const bestStrength = getPlayStrength(best, leadSuit, trumpSuit);
    const currentStrength = getPlayStrength(current, leadSuit, trumpSuit);

    if (currentStrength.tier > bestStrength.tier) {
      return current;
    }
    if (currentStrength.tier === bestStrength.tier && currentStrength.rank > bestStrength.rank) {
      return current;
    }
    return best;
  });

  return winningPlay.playerId;
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
  const playerToken = existingGame.playerTokens.find(
    (entry) => entry.token === event.payload.playerToken,
  );
  if (!playerToken) {
    throw new Error("Invalid player token");
  }
  if (playerToken.playerId !== turnPlayerId) {
    throw new Error("It is not this player's turn to play");
  }

  const currentPlayerHand = phase.cards.hands.find((hand) => hand.playerId === turnPlayerId);
  if (!currentPlayerHand) {
    throw new Error("Current player's hand not found");
  }
  if (
    !currentPlayerHand.cards.some(
      (card) => card.rank === event.payload.card.rank && card.suit === event.payload.card.suit,
    )
  ) {
    throw new Error("Played card not found in current player's hand");
  }

  const currentTrick: Trick = phase.cards.currentTrick ?? {
    index: phase.trickIndex,
    leadPlayerId: turnPlayerId,
    plays: [],
  };

  if (currentTrick.plays.some((play) => play.playerId === turnPlayerId)) {
    throw new Error("Current player has already played this trick");
  }

  const trumpCard = phase.cards.trump;
  if (!trumpCard) {
    throw new Error("Trump card is not set for Playing phase");
  }
  const trumpSuit = trumpCard.suit;
  const leadCard = currentTrick.plays[0]?.card;
  const leadSuit = leadCard ? getNormalizedSuit(leadCard, trumpSuit) : undefined;
  const playedCardSuit = getNormalizedSuit(event.payload.card, trumpSuit);
  const playedCardIsTrump = isTrumpCard(event.payload.card, trumpSuit);
  const playerHasLeadSuit = leadSuit
    ? hasSuit(currentPlayerHand.cards, leadSuit, trumpSuit)
    : false;

  if (!leadSuit) {
    if (
      playedCardIsTrump &&
      !canLeadTrump(currentPlayerHand.cards, trumpSuit, phase.cards.trumpBroken)
    ) {
      throw new Error("Cannot lead with trump until trump is broken");
    }
  } else if (playerHasLeadSuit && playedCardSuit !== leadSuit) {
    throw new Error("Player must follow the leading suit when possible");
  }

  let nextTrumpBroken = phase.cards.trumpBroken;
  if (!nextTrumpBroken && playedCardIsTrump) {
    if (!leadSuit) {
      const hasAnyNonTrump = currentPlayerHand.cards.some((card) => !isTrumpCard(card, trumpSuit));
      if (!hasAnyNonTrump) {
        nextTrumpBroken = true;
      }
    } else if (!playerHasLeadSuit) {
      nextTrumpBroken = true;
    }
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
      phase: withTurnDueAt(existingGame, {
        ...phase,
        turnPlayerId: getNextPlayerId(existingGame.playerOrder, turnPlayerId),
        turnStartedAt: Date.now(),
        cards: {
          ...phase.cards,
          trumpBroken: nextTrumpBroken,
          hands: nextHands,
          currentTrick: nextTrick,
        },
      }),
    });
  }

  const winnerPlayerId = resolveTrickWinner(nextTrick, trumpSuit);

  const completedTrick: Trick = {
    ...nextTrick,
    winnerPlayerId,
  };
  const allHandsEmpty = nextHands.every((hand) => hand.cards.length === 0);
  if (allHandsEmpty) {
    const { turnPlayerId: _turnPlayerId, ...scoringPhase } = phase;
    const scoringState = {
      ...existingGame,
      phase: {
        ...scoringPhase,
        stage: "Scoring" as const,
        trickIndex: phase.trickIndex + 1,
        cards: {
          ...phase.cards,
          trumpBroken: nextTrumpBroken,
          hands: nextHands,
          currentTrick: undefined,
          completedTricks: [...phase.cards.completedTricks, completedTrick],
        },
      },
    };
    const updatedScores = scoreRound(scoringState);

    return withNextVersion(existingGame, {
      phase: {
        ...scoringState.phase,
        stage: "EndOfRound" as const,
        advanceAfter: Date.now() + END_OF_ROUND_DELAY_MS,
      },
      scores: updatedScores,
    });
  }

  const nextTrickIndex = phase.trickIndex + 1;
  const nextTurnPlayerId = winnerPlayerId;
  return withNextVersion(existingGame, {
    phase: withTurnDueAt(existingGame, {
      ...phase,
      trickIndex: nextTrickIndex,
      turnPlayerId: nextTurnPlayerId,
      turnStartedAt: Date.now(),
      cards: {
        ...phase.cards,
        trumpBroken: nextTrumpBroken,
        hands: nextHands,
        currentTrick: undefined,
        completedTricks: [...phase.cards.completedTricks, completedTrick],
      },
    }),
  });
};
