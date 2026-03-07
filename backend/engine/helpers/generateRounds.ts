import type { CardCount, Round } from "@shared/types/game";

export const generateRounds = (maxCards: CardCount): Round[] => {
  const rounds: Round[] = [];

  for (let cardCount = maxCards; cardCount >= 1; cardCount -= 1) {
    rounds.push({
      cardCount: cardCount as CardCount,
      direction: "down",
    });
  }

  for (let cardCount = 2; cardCount <= maxCards; cardCount += 1) {
    rounds.push({
      cardCount: cardCount as CardCount,
      direction: "up",
    });
  }

  return rounds;
};
