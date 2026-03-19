import type { Card, Game, Hand, Rank, Suit } from "@shared/types/game";
import type { LambdaEventPayload } from "@shared/types/lambda";
import { requirePlayerActionContext } from "../helpers/reducer/validation/actionContext";

const RANK_ORDER: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "LJ", "BJ"];
const SUIT_ORDER: Exclude<Suit, "Joker">[] = ["Clubs", "Diamonds", "Hearts", "Spades"];

const rankValue = (rank: Rank): number => RANK_ORDER.indexOf(rank);

const sortByRank = (cards: Card[]): Card[] =>
  [...cards].sort((a, b) => {
    const rankDiff = rankValue(a.rank) - rankValue(b.rank);
    if (rankDiff !== 0) {
      return rankDiff;
    }

    const suitA = a.suit === "Joker" ? 99 : SUIT_ORDER.indexOf(a.suit as Exclude<Suit, "Joker">);
    const suitB = b.suit === "Joker" ? 99 : SUIT_ORDER.indexOf(b.suit as Exclude<Suit, "Joker">);
    return suitA - suitB;
  });

const sortBySuit = (cards: Card[], trumpSuit?: Suit): Card[] =>
  [...cards].sort((a, b) => {
    const normalizedSuit = (card: Card): number => {
      if (card.suit === "Joker") {
        return trumpSuit && trumpSuit !== "Joker" ? SUIT_ORDER.length : SUIT_ORDER.length + 1;
      }

      const suitIndex = SUIT_ORDER.indexOf(card.suit as Exclude<Suit, "Joker">);
      if (trumpSuit && trumpSuit !== "Joker" && card.suit === trumpSuit) {
        return SUIT_ORDER.length;
      }

      return suitIndex;
    };

    const suitDiff = normalizedSuit(a) - normalizedSuit(b);
    if (suitDiff !== 0) {
      return suitDiff;
    }

    if (a.suit === "Joker" && b.suit !== "Joker") {
      return 1;
    }

    if (a.suit !== "Joker" && b.suit === "Joker") {
      return -1;
    }

    return rankValue(a.rank) - rankValue(b.rank);
  });

const replacePlayerHand = (hands: Hand[], playerId: string, cards: Card[]): Hand[] =>
  hands.map((hand) => (hand.playerId === playerId ? { ...hand, cards } : hand));

export const sortCards = (
  game: Game | undefined,
  event: LambdaEventPayload<"sortCards">,
): Game => {
  const { game: existingGame, playerId } = requirePlayerActionContext(game, event);
  if (!("cards" in existingGame.phase)) {
    throw new Error("Cards cannot be sorted in the current phase");
  }

  if (existingGame.phase.stage === "Dealing") {
    throw new Error("Cards cannot be sorted during Dealing");
  }

  const playerHand = existingGame.phase.cards.hands.find((hand) => hand.playerId === playerId);
  if (!playerHand) {
    throw new Error("Player hand not found");
  }

  const trumpSuit = existingGame.phase.cards.trump?.suit;
  const sortedCards =
    event.payload.mode === "bySuit"
      ? sortBySuit(playerHand.cards, trumpSuit)
      : sortByRank(playerHand.cards);

  return {
    ...existingGame,
    version: existingGame.version + 1,
    phase: {
      ...existingGame.phase,
      cards: {
        ...existingGame.phase.cards,
        hands: replacePlayerHand(existingGame.phase.cards.hands, playerId, sortedCards),
      },
    },
  };
};
