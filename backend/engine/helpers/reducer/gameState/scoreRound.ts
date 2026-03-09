import type { Card, Game, Score, Suit } from "@shared/types/game";

const STANDARD_SUITS: Exclude<Suit, "Joker">[] = ["Clubs", "Diamonds", "Hearts", "Spades"];

const normalizeSuit = (card: Card, trumpSuit: Suit): Suit =>
  card.suit === "Joker" ? trumpSuit : card.suit;

const hasAllSuitsWithTrumpJokerRule = (cards: Card[], trumpSuit: Suit): boolean => {
  const normalizedSuits = new Set(cards.map((card) => normalizeSuit(card, trumpSuit)));
  return STANDARD_SUITS.every((suit) => normalizedSuits.has(suit));
};

const buildPlayedCardsByPlayer = (game: Game): Map<string, Card[]> => {
  if (game.phase.stage !== "Scoring") {
    throw new Error("scoreRound requires Scoring phase");
  }

  const playedCardsByPlayer = new Map<string, Card[]>();
  for (const trick of game.phase.cards.completedTricks) {
    for (const play of trick.plays) {
      const existingCards = playedCardsByPlayer.get(play.playerId) ?? [];
      playedCardsByPlayer.set(play.playerId, [...existingCards, play.card]);
    }
  }

  return playedCardsByPlayer;
};

const scoreForPlayer = (
  tricksWon: number,
  bidAmount: number,
  tripped: boolean,
  cardCount: number,
): number => {
  if (tripped) {
    if (tricksWon === cardCount) {
      return 30 * tricksWon;
    }
    return -30 * bidAmount;
  }

  if (tricksWon >= bidAmount) {
    const base = 10 * bidAmount;
    const overTricks = Math.max(0, tricksWon - bidAmount);
    return base + overTricks;
  }

  return -10 * bidAmount;
};

export const scoreRound = (game: Game): Score[] => {
  if (game.phase.stage !== "Scoring") {
    throw new Error("scoreRound requires Scoring phase");
  }
  const scoringPhase = game.phase;
  const trumpCard = scoringPhase.cards.trump;
  if (!trumpCard) {
    throw new Error("scoreRound requires a trump card");
  }

  const round = game.options.rounds[scoringPhase.roundIndex];
  if (!round) {
    throw new Error("Round not found for scoring");
  }

  const tricksWonByPlayer = new Map<string, number>();
  for (const trick of scoringPhase.cards.completedTricks) {
    if (!trick.winnerPlayerId) {
      continue;
    }
    const current = tricksWonByPlayer.get(trick.winnerPlayerId) ?? 0;
    tricksWonByPlayer.set(trick.winnerPlayerId, current + 1);
  }

  const playedCardsByPlayer = buildPlayedCardsByPlayer(game);
  const bidByPlayerId = new Map(scoringPhase.bids.map((bid) => [bid.playerId, bid]));

  return game.playerOrder.map((playerId) => {
    const existingScore = game.scores.find((score) => score.playerId === playerId) ?? {
      playerId,
      total: 0,
      possible: 0,
      rounds: [],
    };
    const existingRounds = Array.isArray(existingScore.rounds)
      ? existingScore.rounds.map((value) =>
          typeof value === "number"
            ? {
                total: value,
                possible: 0,
              }
            : value,
        )
      : [];
    const bid = bidByPlayerId.get(playerId);
    if (!bid) {
      throw new Error("Missing bid for player during scoring");
    }

    const tricksWon = tricksWonByPlayer.get(playerId) ?? 0;
    let delta = scoreForPlayer(tricksWon, bid.amount, bid.trip, round.cardCount);

    if (round.cardCount === 4) {
      const playedCards = playedCardsByPlayer.get(playerId) ?? [];
      if (hasAllSuitsWithTrumpJokerRule(playedCards, trumpCard.suit)) {
        delta += 25;
      }
    }

    const possibleMultiplier =
      round.cardCount <= 3 && tricksWon === round.cardCount
        ? 30
        : 10;
    const roundResult = {
      total: delta,
      possible: tricksWon * possibleMultiplier,
    };
    const rounds = [...existingRounds, roundResult];
    const total = rounds.reduce((sum, value) => sum + value.total, 0);
    const possible = rounds.reduce((sum, value) => sum + value.possible, 0);

    return {
      ...existingScore,
      rounds,
      total,
      possible,
    };
  });
};
