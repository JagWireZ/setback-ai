import type { CardCount } from "@shared/types/game";

const MAX_SUPPORTED_CARD_COUNT = 10;
const TRUMP_RESERVE_CARDS = 1;

export const getMaxCardsForSeatCount = (seatCount: number): CardCount => {
  if (!Number.isInteger(seatCount) || seatCount < 1) {
    throw new Error("Seat count must be a positive integer");
  }

  return Math.min(
    MAX_SUPPORTED_CARD_COUNT,
    Math.floor((54 - TRUMP_RESERVE_CARDS) / seatCount),
  ) as CardCount;
};
