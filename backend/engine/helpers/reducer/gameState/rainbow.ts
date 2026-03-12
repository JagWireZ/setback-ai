import type { Card, Score, Suit } from "@shared/types/game";

const STANDARD_SUITS: Exclude<Suit, "Joker">[] = ["Clubs", "Diamonds", "Hearts", "Spades"];

export const normalizeRainbowSuit = (card: Card, trumpSuit: Suit): Suit =>
  card.suit === "Joker" ? trumpSuit : card.suit;

export const hasRainbow = (cards: Card[], trumpSuit: Suit, cardCount: number): boolean => {
  if (cardCount !== 4) {
    return false;
  }

  const normalizedSuits = new Set(cards.map((card) => normalizeRainbowSuit(card, trumpSuit)));
  return STANDARD_SUITS.every((suit) => normalizedSuits.has(suit));
};

export const applyRainbowPreviewToScores = (
  scores: Score[],
  handsByPlayerId: Map<string, Card[]>,
  trumpSuit: Suit,
  roundIndex: number,
  cardCount: number,
): Score[] =>
  scores.map((score) => {
    const cards = handsByPlayerId.get(score.playerId) ?? [];
    const rainbow = hasRainbow(cards, trumpSuit, cardCount);
    const existingRound = score.rounds[roundIndex];
    const nextRound = {
      total: rainbow ? 25 : 0,
      possible: 0,
      rainbow,
      bid: typeof existingRound?.bid === "number" ? existingRound.bid : 0,
      books: typeof existingRound?.books === "number" ? existingRound.books : 0,
    };
    const rounds = [...score.rounds];
    rounds[roundIndex] = nextRound;
    const total = rounds.reduce((sum, value) => sum + (value?.total ?? 0), 0);
    const possible = rounds.reduce((sum, value) => sum + (value?.possible ?? 0), 0);

    return {
      ...score,
      rounds,
      total,
      possible,
    };
  });
