import type { Card, Rank, Suit } from "@shared/types/game";

const SUITS: Suit[] = ["Clubs", "Diamonds", "Hearts", "Spades"];
const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const JOKERS: Card[] = [
  {
    suit: 'Joker',
    rank: 'LJ',
  },
  {
    suit: 'Joker',
    rank: 'BJ',
  },
]

const createDeck = (): Card[] => {
  let standardDeck: Card[] = [];

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      standardDeck = [ ...standardDeck, { rank, suit }];
    }
  }

  standardDeck = [ ...standardDeck, ...JOKERS ];
  return standardDeck;
};

export const shuffleCards = (): Card[] => {
  const deck = createDeck();

  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
};
