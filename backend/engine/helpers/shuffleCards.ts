import type { Card, Rank, Suit } from "@shared/types/game";

const STANDARD_SUITS: Exclude<Suit, "Joker">[] = ["Clubs", "Diamonds", "Hearts", "Spades"];
const STANDARD_RANKS: Exclude<Rank, "LJ" | "BJ">[] = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];
const JOKERS: Card[] = [
  { suit: "Joker", rank: "LJ" },
  { suit: "Joker", rank: "BJ" },
];

const createDeck = (): Card[] => {
  const standardDeck: Card[] = [];

  for (const suit of STANDARD_SUITS) {
    for (const rank of STANDARD_RANKS) {
      standardDeck.push({ rank, suit });
    }
  }

  return [...standardDeck, ...JOKERS];
};

export const shuffleCards = (): Card[] => {
  const deck = createDeck();

  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
};
