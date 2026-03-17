import type { AIDifficulty, Card, Game, Trick, TrickPlay } from "@shared/types/game";
import type { LambdaEventPayload } from "@shared/types/lambda";
import { advancePhase } from "../helpers/reducer/gameState/advancePhase";
import { withNextVersion } from "../helpers/reducer/gameState/withNextVersion";
import { getPlayerController, getPlayerPresence } from "../helpers/reducer/player/presence";
import { dealCards } from "../reducer/dealCards";
import { playCard } from "../reducer/playCard";
import { submitBid } from "../reducer/submitBid";

const MAX_REVIEW_STEPS = 200;

const getPlayerTokenById = (game: Game, playerId: string): string => {
  const tokenEntry = game.playerTokens.find((entry) => entry.playerId === playerId);
  if (!tokenEntry) {
    throw new Error("Missing player token for AI player");
  }

  return tokenEntry.token;
};

const getAutomatedTurnPlayer = (
  game: Game,
  controlledPlayerId?: string,
): { playerId: string; token: string } | undefined => {
  if (!("turnPlayerId" in game.phase)) {
    return undefined;
  }

  const turnPlayerId = game.phase.turnPlayerId;
  if (controlledPlayerId && turnPlayerId !== controlledPlayerId) {
    return undefined;
  }

  const turnPlayer = game.players.find((player) => player.id === turnPlayerId);
  if (!turnPlayer) {
    return undefined;
  }

  const isAiPlayer = turnPlayer.type === "ai";
  const isAiTemporaryController = getPlayerController(turnPlayer) === "ai-temporary";
  const isAwayHumanOverride =
    Boolean(controlledPlayerId) && turnPlayer.type === "human" && getPlayerPresence(turnPlayer).away;
  if (!isAiPlayer && !isAiTemporaryController && !isAwayHumanOverride) {
    return undefined;
  }

  return {
    playerId: turnPlayerId,
    token: getPlayerTokenById(game, turnPlayerId),
  };
};

const clampBid = (bid: number, cardCount: number): number =>
  Math.max(0, Math.min(cardCount, Math.trunc(bid)));

const SUITS: Array<Card["suit"]> = ["Clubs", "Diamonds", "Hearts", "Spades"];
const HIGH_TRUMP_RANKS = new Set<Card["rank"]>(["A", "K", "Q", "J", "10"]);
const LOW_TRUMP_RANKS = new Set<Card["rank"]>(["2", "3", "4", "5", "6", "7", "8", "9"]);
const ROYAL_RANKS = new Set<Card["rank"]>(["A", "K", "Q", "J"]);

const getDifficultySettings = (
  difficulty: AIDifficulty,
): {
  riskOffset: number;
  pressurePenalty: number;
  contestBoost: number;
  tripSlack: number;
  roundBias: (value: number) => number;
} => {
  switch (difficulty) {
    case "easy":
      return {
        riskOffset: -0.35,
        pressurePenalty: 0.38,
        contestBoost: 0.12,
        tripSlack: -0.2,
        roundBias: (value) => Math.floor(Math.max(0, value + 0.1)),
      };
    case "hard":
      return {
        riskOffset: 0.35,
        pressurePenalty: 0.14,
        contestBoost: 0.45,
        tripSlack: 0.2,
        roundBias: (value) => Math.ceil(Math.max(0, value - 0.15)),
      };
    case "medium":
    default:
      return {
        riskOffset: 0,
        pressurePenalty: 0.24,
        contestBoost: 0.26,
        tripSlack: 0,
        roundBias: (value) => Math.round(Math.max(0, value)),
      };
  }
};

const getPlayerHistoryAdjustment = (game: Game, playerId: string): number => {
  const score = game.scores.find((entry) => entry.playerId === playerId);
  if (!score || !Array.isArray(score.rounds) || score.rounds.length === 0) {
    return 0;
  }

  const completedRounds = score.rounds.filter(
    (round) => typeof round?.bid === "number" && typeof round?.books === "number",
  );
  if (completedRounds.length === 0) {
    return 0;
  }

  const averageDelta =
    completedRounds.reduce((sum, round) => sum + (round.books - round.bid), 0) / completedRounds.length;

  return Math.max(-0.35, Math.min(0.35, averageDelta * 0.18));
};

const countCardsOfSuit = (cards: Card[], suit: Card["suit"]): number =>
  cards.filter((card) => card.suit === suit).length;

const analyzeBidHand = (cards: Card[], trumpSuit: Card["suit"], roundCardCount: number) => {
  const isSmallRound = roundCardCount <= 3;
  const isBigRound = roundCardCount >= 6;
  const trumpCards = cards.filter((card) => card.suit === trumpSuit);
  const bigJokerCount = cards.filter((card) => card.rank === "BJ").length;
  const littleJokerCount = cards.filter((card) => card.rank === "LJ").length;
  const jokerCount = bigJokerCount + littleJokerCount;
  const trumpEquivalentCount = trumpCards.length + jokerCount;
  const highTrumpCards = trumpCards.filter((card) => HIGH_TRUMP_RANKS.has(card.rank));
  const lowTrumpCards = trumpCards.filter((card) => LOW_TRUMP_RANKS.has(card.rank));
  const offSuitAces = cards.filter((card) => card.rank === "A" && card.suit !== trumpSuit).length;
  const offSuitKings = cards.filter((card) => card.rank === "K" && card.suit !== trumpSuit).length;
  const hasAceTrump = trumpCards.some((card) => card.rank === "A");
  const hasKingTrump = trumpCards.some((card) => card.rank === "K");
  const hasRoyalOrAce = cards.some(
    (card) => card.suit === "Joker" || ROYAL_RANKS.has(card.rank),
  );
  const missingNonTrumpSuitCount = SUITS.filter(
    (suit) => suit !== trumpSuit && countCardsOfSuit(cards, suit) === 0,
  ).length;

  let expectedTricks = 0;
  expectedTricks += bigJokerCount;
  expectedTricks += littleJokerCount * (isSmallRound ? 0.95 : 0.85);
  expectedTricks += highTrumpCards.reduce((sum, card) => {
    if (card.rank === "A") {
      return sum + (isSmallRound ? 1 : 0.95);
    }
    if (card.rank === "K") {
      return sum + (isSmallRound ? 0.72 : 0.82);
    }
    if (card.rank === "Q") {
      return sum + (isSmallRound ? 0.54 : 0.68);
    }
    if (card.rank === "J") {
      return sum + (isSmallRound ? 0.42 : 0.56);
    }
    return sum + 0.5;
  }, 0);
  expectedTricks += lowTrumpCards.length * (isSmallRound ? 0.42 : 0.56);
  expectedTricks += offSuitAces * (isSmallRound ? 0.55 : 0.9);
  expectedTricks += offSuitKings * (isSmallRound ? 0.14 : 0.26);

  if (missingNonTrumpSuitCount > 0 && trumpEquivalentCount > 0 && isBigRound) {
    expectedTricks += Math.min(missingNonTrumpSuitCount, trumpEquivalentCount) * 0.38;
  }

  if (bigJokerCount > 0 && littleJokerCount > 0) {
    expectedTricks = Math.max(expectedTricks, 2);
  }

  if (isBigRound && offSuitAces > 0 && trumpEquivalentCount === 0) {
    expectedTricks = Math.max(expectedTricks, offSuitAces);
  }

  return {
    isSmallRound,
    isBigRound,
    jokerCount,
    bigJokerCount,
    littleJokerCount,
    trumpCards,
    trumpEquivalentCount,
    highTrumpCards,
    lowTrumpCards,
    offSuitAces,
    hasAceTrump,
    hasKingTrump,
    hasRoyalOrAce,
    missingNonTrumpSuitCount,
    expectedTricks,
  };
};

const isFirstHighestBidderIfMatched = (
  game: Game,
  aiPlayerId: string,
  targetBid: number,
): boolean => {
  if (game.phase.stage !== "Bidding") {
    return false;
  }

  const dealerIndex = game.playerOrder.indexOf(game.phase.dealerPlayerId);
  if (dealerIndex < 0) {
    return false;
  }

  const highestBidPlayers = new Set(
    game.phase.bids.filter((bid) => bid.amount === targetBid).map((bid) => bid.playerId),
  );
  highestBidPlayers.add(aiPlayerId);

  for (let offset = 1; offset <= game.playerOrder.length; offset += 1) {
    const playerId = game.playerOrder[(dealerIndex + offset) % game.playerOrder.length];
    if (highestBidPlayers.has(playerId)) {
      return playerId === aiPlayerId;
    }
  }

  return false;
};

const shouldTripBid = (
  game: Game,
  roundCardCount: number,
  handAnalysis: ReturnType<typeof analyzeBidHand>,
  candidateBid: number,
  difficulty: AIDifficulty,
): boolean => {
  const alreadyTripped = game.phase.stage === "Bidding" && game.phase.bids.some((bid) => bid.trip);
  const currentHighBid =
    game.phase.stage === "Bidding" && game.phase.bids.length > 0
      ? Math.max(...game.phase.bids.map((bid) => bid.amount))
      : 0;
  const difficultySettings = getDifficultySettings(difficulty);

  if (roundCardCount === 3) {
    return !alreadyTripped && handAnalysis.jokerCount > 0 && handAnalysis.trumpEquivalentCount >= 3;
  }

  if (roundCardCount === 2) {
    return (
      (handAnalysis.jokerCount > 0 || handAnalysis.hasAceTrump) &&
      handAnalysis.trumpEquivalentCount >= 2
    );
  }

  if (roundCardCount === 1) {
    return handAnalysis.jokerCount > 0 || handAnalysis.hasAceTrump || handAnalysis.hasKingTrump;
  }

  if (
    roundCardCount <= 3 &&
    currentHighBid === 0 &&
    candidateBid >= roundCardCount &&
    handAnalysis.expectedTricks >= roundCardCount - 0.15 + difficultySettings.tripSlack
  ) {
    return true;
  }

  return false;
};

const chooseAiBid = (game: Game): { bid: number; trip?: boolean } => {
  if (game.phase.stage !== "Bidding") {
    throw new Error("AI bid requested outside Bidding phase");
  }

  const round = game.options.rounds[game.phase.roundIndex];
  if (!round) {
    throw new Error("Round not found for current phase");
  }

  const aiPlayerId = game.phase.turnPlayerId;
  const aiHand = game.phase.cards.hands.find((hand) => hand.playerId === aiPlayerId);
  if (!aiHand) {
    throw new Error("AI hand not found for bidding");
  }

  const trumpSuit = game.phase.cards.trump?.suit;
  if (!trumpSuit) {
    return { bid: 0 };
  }

  const difficulty = game.options.aiDifficulty ?? "medium";
  const difficultySettings = getDifficultySettings(difficulty);
  const handAnalysis = analyzeBidHand(aiHand.cards, trumpSuit, round.cardCount);
  const previousBids = game.options.blindBid ? [] : game.phase.bids;
  const previousBidTotal = previousBids.reduce((sum, bid) => sum + bid.amount, 0);
  const currentHighBid = previousBids.reduce((max, bid) => Math.max(max, bid.amount), 0);
  const bidPressure = round.cardCount > 0 ? previousBidTotal / round.cardCount : 0;
  const remainingPlayers = Math.max(0, game.playerOrder.length - previousBids.length - 1);
  const remainingPressureEstimate = remainingPlayers * (round.cardCount / game.playerOrder.length) * 0.35;
  const historyAdjustment = getPlayerHistoryAdjustment(game, aiPlayerId);
  const strategy = Math.random() < 0.5 ? "maximize" : "contest";

  if (!handAnalysis.hasRoyalOrAce && handAnalysis.trumpEquivalentCount === 0) {
    return { bid: 0 };
  }

  if (
    handAnalysis.isBigRound &&
    handAnalysis.lowTrumpCards.length > 0 &&
    handAnalysis.highTrumpCards.length === 0 &&
    handAnalysis.offSuitAces === 0 &&
    handAnalysis.missingNonTrumpSuitCount === 0
  ) {
    return { bid: 0 };
  }

  let bidEstimate =
    handAnalysis.expectedTricks +
    difficultySettings.riskOffset +
    historyAdjustment;

  if (!game.options.blindBid) {
    const strongHandBoost =
      handAnalysis.bigJokerCount +
      handAnalysis.highTrumpCards.length * 0.3 +
      handAnalysis.offSuitAces * 0.2;
    bidEstimate -= Math.max(0, bidPressure - strongHandBoost * 0.12) * difficultySettings.pressurePenalty;
    bidEstimate -= remainingPressureEstimate * 0.12;

    const canChallengeHighBid =
      bidEstimate + handAnalysis.jokerCount * 0.25 + handAnalysis.highTrumpCards.length * 0.18 >=
      currentHighBid - 0.2;

    if (strategy === "contest" && currentHighBid > 0 && canChallengeHighBid) {
      const tieAdvantage = isFirstHighestBidderIfMatched(game, aiPlayerId, currentHighBid);
      if (tieAdvantage) {
        bidEstimate = Math.max(bidEstimate, currentHighBid + difficultySettings.contestBoost * 0.5);
      } else if (difficulty === "hard") {
        bidEstimate = Math.max(bidEstimate, currentHighBid + difficultySettings.contestBoost);
      } else {
        bidEstimate = Math.max(bidEstimate, currentHighBid);
      }
    }
  }

  const roundedBid = clampBid(difficultySettings.roundBias(bidEstimate), round.cardCount);

  if (shouldTripBid(game, round.cardCount, handAnalysis, roundedBid, difficulty)) {
    return {
      bid: round.cardCount,
      trip: true,
    };
  }

  return {
    bid:
      handAnalysis.isBigRound && handAnalysis.offSuitAces > 0 && handAnalysis.trumpEquivalentCount === 0
        ? Math.max(roundedBid, handAnalysis.offSuitAces)
        : roundedBid,
  };
};

const CARD_RANK_VALUE: Record<string, number> = {
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
  LJ: 15,
  BJ: 16,
};

const getCardRankValue = (card: Card): number => CARD_RANK_VALUE[card.rank] ?? 0;

const getNormalizedSuit = (card: Card, trumpSuit: Card["suit"]): Card["suit"] =>
  card.suit === "Joker" ? trumpSuit : card.suit;

const isTrumpCard = (card: Card, trumpSuit: Card["suit"]): boolean =>
  getNormalizedSuit(card, trumpSuit) === trumpSuit;

const isRankedTrump = (card: Card, trumpSuit: Card["suit"]): boolean =>
  card.suit !== "Joker" && card.suit === trumpSuit;

const chooseLowestCard = (cards: Card[], trumpSuit: Card["suit"]): Card => {
  const sorted = [...cards].sort((a, b) => {
    const aTrumpPenalty = isTrumpCard(a, trumpSuit) ? 1 : 0;
    const bTrumpPenalty = isTrumpCard(b, trumpSuit) ? 1 : 0;
    if (aTrumpPenalty !== bTrumpPenalty) {
      return aTrumpPenalty - bTrumpPenalty;
    }
    return getCardRankValue(a) - getCardRankValue(b);
  });
  return sorted[0];
};

const getPlayStrength = (
  card: Card,
  leadSuit: Card["suit"],
  trumpSuit: Card["suit"],
): { tier: number; rank: number } => {
  if (card.rank === "BJ") {
    return { tier: 4, rank: 100 };
  }
  if (card.rank === "LJ") {
    return { tier: 3, rank: 100 };
  }

  const normalizedSuit = getNormalizedSuit(card, trumpSuit);
  if (normalizedSuit === trumpSuit) {
    return { tier: 2, rank: getCardRankValue(card) };
  }
  if (normalizedSuit === leadSuit) {
    return { tier: 1, rank: getCardRankValue(card) };
  }
  return { tier: 0, rank: getCardRankValue(card) };
};

const cardBeats = (
  candidate: Card,
  currentWinner: Card,
  leadSuit: Card["suit"],
  trumpSuit: Card["suit"],
): boolean => {
  const candidateStrength = getPlayStrength(candidate, leadSuit, trumpSuit);
  const winnerStrength = getPlayStrength(currentWinner, leadSuit, trumpSuit);
  if (candidateStrength.tier > winnerStrength.tier) {
    return true;
  }
  return candidateStrength.tier === winnerStrength.tier && candidateStrength.rank > winnerStrength.rank;
};

const HIGH_TRUMP_VALUES = new Set<number>([11, 12, 13, 14, 15, 16]);
const TRUMP_ORDER = ["BJ", "LJ", "A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"];

const getBooksWonByPlayer = (game: Game): Map<string, number> => {
  if (game.phase.stage !== "Playing") {
    return new Map();
  }

  const books = new Map<string, number>();
  for (const trick of game.phase.cards.completedTricks) {
    if (!trick.winnerPlayerId) {
      continue;
    }
    books.set(trick.winnerPlayerId, (books.get(trick.winnerPlayerId) ?? 0) + 1);
  }
  return books;
};

const getBidAmountByPlayer = (game: Game): Map<string, number> =>
  new Map(
    game.phase.stage === "Playing" || game.phase.stage === "Bidding"
      ? game.phase.bids.map((bid) => [bid.playerId, bid.amount])
      : [],
  );

const getCurrentRoundLeaders = (game: Game, aiPlayerId: string): Set<string> => {
  const booksWon = getBooksWonByPlayer(game);
  let maxBooks = -1;
  const leaders = new Set<string>();

  for (const playerId of game.playerOrder) {
    if (playerId === aiPlayerId) {
      continue;
    }

    const books = booksWon.get(playerId) ?? 0;
    if (books > maxBooks) {
      leaders.clear();
      leaders.add(playerId);
      maxBooks = books;
    } else if (books === maxBooks) {
      leaders.add(playerId);
    }
  }

  return leaders;
};

const getCurrentWinnerPlay = (
  currentTrick: Trick,
  trumpSuit: Card["suit"],
): TrickPlay => {
  const leadSuit = getNormalizedSuit(currentTrick.plays[0].card, trumpSuit);
  return currentTrick.plays.reduce((best, play) =>
    cardBeats(play.card, best.card, leadSuit, trumpSuit) ? play : best,
  );
};

const getCardsPlayedSoFar = (game: Game): Card[] => {
  if (game.phase.stage !== "Playing") {
    return [];
  }

  const cards: Card[] = [];
  for (const trick of game.phase.cards.completedTricks) {
    for (const play of trick.plays) {
      cards.push(play.card);
    }
  }
  for (const play of game.phase.cards.currentTrick?.plays ?? []) {
    cards.push(play.card);
  }
  return cards;
};

const getInferredVoidSuits = (
  game: Game,
  trumpSuit: Card["suit"],
): Map<string, Set<Card["suit"]>> => {
  const voids = new Map<string, Set<Card["suit"]>>();
  if (game.phase.stage !== "Playing") {
    return voids;
  }

  const allTricks = [
    ...game.phase.cards.completedTricks,
    ...(game.phase.cards.currentTrick ? [game.phase.cards.currentTrick] : []),
  ];

  for (const trick of allTricks) {
    const leadCard = trick.plays[0]?.card;
    if (!leadCard) {
      continue;
    }
    const leadSuit = getNormalizedSuit(leadCard, trumpSuit);
    for (const play of trick.plays.slice(1)) {
      if (getNormalizedSuit(play.card, trumpSuit) === leadSuit) {
        continue;
      }
      const existing = voids.get(play.playerId) ?? new Set<Card["suit"]>();
      existing.add(leadSuit);
      voids.set(play.playerId, existing);
    }
  }

  return voids;
};

const getUnseenHigherTrumpCount = (
  card: Card,
  hand: Card[],
  playedCards: Card[],
  trumpSuit: Card["suit"],
): number => {
  if (!isTrumpCard(card, trumpSuit)) {
    return 0;
  }

  const myTrumpRanks = new Set(hand.filter((candidate) => isTrumpCard(candidate, trumpSuit)).map((candidate) => candidate.rank));
  const seenTrumpRanks = new Set(playedCards.filter((candidate) => isTrumpCard(candidate, trumpSuit)).map((candidate) => candidate.rank));
  const cardIndex = TRUMP_ORDER.indexOf(card.rank);
  if (cardIndex < 0) {
    return 0;
  }

  return TRUMP_ORDER.slice(0, cardIndex).filter(
    (rank) => !myTrumpRanks.has(rank as Card["rank"]) && !seenTrumpRanks.has(rank as Card["rank"]),
  ).length;
};

const chooseDiscardCard = (
  cards: Card[],
  hand: Card[],
  trumpSuit: Card["suit"],
): Card => {
  const suitCounts = new Map<Card["suit"], number>();
  for (const card of hand) {
    const normalizedSuit = getNormalizedSuit(card, trumpSuit);
    suitCounts.set(normalizedSuit, (suitCounts.get(normalizedSuit) ?? 0) + 1);
  }

  return [...cards].sort((a, b) => {
    const aIsTrump = isTrumpCard(a, trumpSuit) ? 1 : 0;
    const bIsTrump = isTrumpCard(b, trumpSuit) ? 1 : 0;
    if (aIsTrump !== bIsTrump) {
      return aIsTrump - bIsTrump;
    }

    const aSuitCount = suitCounts.get(getNormalizedSuit(a, trumpSuit)) ?? 0;
    const bSuitCount = suitCounts.get(getNormalizedSuit(b, trumpSuit)) ?? 0;
    if (aSuitCount !== bSuitCount) {
      return bSuitCount - aSuitCount;
    }

    return getCardRankValue(a) - getCardRankValue(b);
  })[0];
};

const chooseBasicPlayableCard = (game: Game, aiPlayerId: string, token: string): Card => {
  if (game.phase.stage !== "Playing") {
    throw new Error("AI play requested outside Playing phase");
  }

  const aiHand = game.phase.cards.hands.find((hand) => hand.playerId === aiPlayerId);
  if (!aiHand) {
    throw new Error("AI hand not found");
  }

  const trumpSuit = game.phase.cards.trump?.suit;
  if (!trumpSuit) {
    throw new Error("Trump card missing during AI play selection");
  }

  const legalCards: Card[] = [];
  let lastError: Error | undefined;
  for (const card of aiHand.cards) {
    const candidateEvent: LambdaEventPayload<"playCard"> = {
      action: "playCard",
      payload: {
        gameId: game.id,
        playerToken: token,
        card,
      },
    };

    try {
      playCard(game, candidateEvent);
      legalCards.push(card);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown AI play error");
    }
  }

  if (legalCards.length === 0) {
    throw lastError ?? new Error("AI has no playable card");
  }
  if (legalCards.length === 1) {
    return legalCards[0];
  }

  const currentTrick = game.phase.cards.currentTrick;
  const leadCard = currentTrick?.plays[0]?.card;

  if (!leadCard) {
    if (game.phase.cards.trumpBroken) {
      const bigJoker = legalCards.find((card) => card.rank === "BJ");
      const hasOtherTrump = legalCards.some((card) => isTrumpCard(card, trumpSuit) && card.rank !== "BJ");
      if (bigJoker && hasOtherTrump) {
        return bigJoker;
      }

      const lowTrumps = legalCards.filter(
        (card) => isRankedTrump(card, trumpSuit) && getCardRankValue(card) <= 7,
      );
      const mediumHighTrumps = legalCards.filter(
        (card) => isRankedTrump(card, trumpSuit) && getCardRankValue(card) >= 11,
      );
      if (lowTrumps.length > 0 && mediumHighTrumps.length > 0) {
        return lowTrumps.sort((a, b) => getCardRankValue(a) - getCardRankValue(b))[0];
      }
    }

    return chooseLowestCard(legalCards, trumpSuit);
  }

  const leadSuit = getNormalizedSuit(leadCard, trumpSuit);
  const hasLeadSuit = aiHand.cards.some((card) => getNormalizedSuit(card, trumpSuit) === leadSuit);

  if (!hasLeadSuit) {
    const rankedTrumpCards = legalCards.filter((card) => isRankedTrump(card, trumpSuit));
    if (rankedTrumpCards.length > 0) {
      return rankedTrumpCards.sort((a, b) => getCardRankValue(a) - getCardRankValue(b))[0];
    }
  }

  const currentWinner = currentTrick?.plays.reduce((best, play) => {
    if (!best) {
      return play.card;
    }
    return cardBeats(play.card, best, leadSuit, trumpSuit) ? play.card : best;
  }, undefined as Card | undefined);

  if (currentWinner) {
    const winningCards = legalCards.filter((card) =>
      cardBeats(card, currentWinner, leadSuit, trumpSuit),
    );
    if (winningCards.length === 0) {
      const nonTrumpCards = legalCards.filter((card) => !isTrumpCard(card, trumpSuit));
      if (nonTrumpCards.length > 0) {
        return chooseLowestCard(nonTrumpCards, trumpSuit);
      }
      return chooseLowestCard(legalCards, trumpSuit);
    }

    return winningCards.sort((a, b) => getCardRankValue(a) - getCardRankValue(b))[0];
  }

  return chooseLowestCard(legalCards, trumpSuit);
};

const chooseStrategicPlayableCard = (game: Game, aiPlayerId: string, token: string): Card => {
  if (game.phase.stage !== "Playing") {
    throw new Error("AI play requested outside Playing phase");
  }

  const aiHand = game.phase.cards.hands.find((hand) => hand.playerId === aiPlayerId);
  if (!aiHand) {
    throw new Error("AI hand not found");
  }

  const trumpSuit = game.phase.cards.trump?.suit;
  if (!trumpSuit) {
    throw new Error("Trump card missing during AI play selection");
  }

  const legalCards: Card[] = [];
  let lastError: Error | undefined;
  for (const card of aiHand.cards) {
    const candidateEvent: LambdaEventPayload<"playCard"> = {
      action: "playCard",
      payload: {
        gameId: game.id,
        playerToken: token,
        card,
      },
    };

    try {
      playCard(game, candidateEvent);
      legalCards.push(card);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown AI play error");
    }
  }

  if (legalCards.length === 0) {
    throw lastError ?? new Error("AI has no playable card");
  }
  if (legalCards.length === 1) {
    return legalCards[0];
  }

  const difficulty = game.options.aiDifficulty ?? "medium";
  const strategyDepth = difficulty === "hard" ? 1 : 0.68;
  const currentTrick = game.phase.cards.currentTrick;
  const playedCards = getCardsPlayedSoFar(game);
  const booksWon = getBooksWonByPlayer(game);
  const bids = getBidAmountByPlayer(game);
  const roundLeaders = getCurrentRoundLeaders(game, aiPlayerId);
  const myBooks = booksWon.get(aiPlayerId) ?? 0;
  const myBid = bids.get(aiPlayerId) ?? 0;
  const booksNeeded = Math.max(0, myBid - myBooks);
  const totalPlayers = game.playerOrder.length;
  const remainingPlayers = Math.max(0, totalPlayers - (currentTrick?.plays.length ?? 0) - 1);
  const isShortRound = (game.options.rounds[game.phase.roundIndex]?.cardCount ?? 0) <= 3;
  const inferredVoids = difficulty === "hard" ? getInferredVoidSuits(game, trumpSuit) : new Map();

  if (!currentTrick?.plays.length) {
    if (game.phase.cards.trumpBroken) {
      const trumpCards = legalCards.filter((card) => isTrumpCard(card, trumpSuit));
      const bigJoker = trumpCards.find((card) => card.rank === "BJ");
      if (bigJoker && trumpCards.length >= 2) {
        return bigJoker;
      }
    }

    const offSuitAces = legalCards.filter(
      (card) => card.rank === "A" && !isTrumpCard(card, trumpSuit),
    );
    if (offSuitAces.length > 0) {
      return offSuitAces.sort((a, b) => {
        const aCount = aiHand.cards.filter((candidate) => candidate.suit === a.suit).length;
        const bCount = aiHand.cards.filter((candidate) => candidate.suit === b.suit).length;
        if (aCount !== bCount) {
          return aCount - bCount;
        }
        return 0;
      })[0];
    }

    if (game.phase.cards.trumpBroken) {
      const lowTrumpBleed = legalCards
        .filter((card) => isRankedTrump(card, trumpSuit) && getCardRankValue(card) <= 9)
        .sort((a, b) => getCardRankValue(a) - getCardRankValue(b));
      if (lowTrumpBleed.length > 0) {
        const hasVulnerableHighTrump = legalCards.some(
          (card) =>
            isTrumpCard(card, trumpSuit) &&
            HIGH_TRUMP_VALUES.has(getCardRankValue(card)) &&
            getUnseenHigherTrumpCount(card, aiHand.cards, playedCards, trumpSuit) > 0,
        );
        if (hasVulnerableHighTrump) {
          return lowTrumpBleed[0];
        }
      }
    }

    const candidateScores = legalCards.map((card) => {
      let score = 0;
      const normalizedSuit = getNormalizedSuit(card, trumpSuit);
      const suitCount = aiHand.cards.filter(
        (candidate) => getNormalizedSuit(candidate, trumpSuit) === normalizedSuit,
      ).length;
      const opponentsVoidInSuit = [...inferredVoids.values()].filter((voids) => voids.has(normalizedSuit)).length;

      if (booksNeeded > 0) {
        score += isTrumpCard(card, trumpSuit) ? 26 * strategyDepth : 14;
        score += getCardRankValue(card) * (isShortRound ? 1.8 : 1.15);
      } else {
        score += isTrumpCard(card, trumpSuit) ? 8 : 0;
        score -= getCardRankValue(card) * 0.25;
      }

      if (!isTrumpCard(card, trumpSuit)) {
        score += suitCount >= 3 ? 8 : 0;
        score -= opponentsVoidInSuit * 6;
      }

      if (card.rank === "A" && !isTrumpCard(card, trumpSuit)) {
        score += 20 * strategyDepth;
      }

      if (difficulty !== "hard") {
        score -= Math.random() * 14;
      }

      return { card, score };
    });

    candidateScores.sort((a, b) => b.score - a.score || getCardRankValue(a.card) - getCardRankValue(b.card));
    return candidateScores[0].card;
  }

  const currentWinnerPlay = getCurrentWinnerPlay(currentTrick, trumpSuit);
  const leadSuit = getNormalizedSuit(currentTrick.plays[0].card, trumpSuit);
  const currentWinnerIsLeader = roundLeaders.has(currentWinnerPlay.playerId);
  const currentWinnerBooks = booksWon.get(currentWinnerPlay.playerId) ?? 0;
  const currentWinnerBid = bids.get(currentWinnerPlay.playerId) ?? 0;
  const leaderThreat =
    currentWinnerIsLeader || (currentWinnerBid > 0 && currentWinnerBooks >= currentWinnerBid);

  if (
    difficulty === "hard" &&
    legalCards.some((card) => card.rank === "BJ") &&
    currentWinnerPlay.playerId !== aiPlayerId &&
    (currentWinnerPlay.card.rank === "LJ" ||
      (isTrumpCard(currentWinnerPlay.card, trumpSuit) &&
        HIGH_TRUMP_VALUES.has(getCardRankValue(currentWinnerPlay.card))))
  ) {
    return legalCards.find((card) => card.rank === "BJ") ?? legalCards[0];
  }

  const winningCards = legalCards.filter((card) => cardBeats(card, currentWinnerPlay.card, leadSuit, trumpSuit));
  const guaranteedWinningCards = winningCards.filter((card) => remainingPlayers === 0);

  if (guaranteedWinningCards.length > 0) {
    const nonTrumpGuaranteed = guaranteedWinningCards.filter((card) => !isTrumpCard(card, trumpSuit));
    if (nonTrumpGuaranteed.length > 0) {
      return nonTrumpGuaranteed.sort((a, b) => getCardRankValue(a) - getCardRankValue(b))[0];
    }
    return guaranteedWinningCards.sort((a, b) => getCardRankValue(a) - getCardRankValue(b))[0];
  }

  if (booksNeeded > 0 && winningCards.length > 0) {
    const preferredWin = [...winningCards].sort((a, b) => {
      const aTrumpPenalty = isTrumpCard(a, trumpSuit) ? 1 : 0;
      const bTrumpPenalty = isTrumpCard(b, trumpSuit) ? 1 : 0;
      if (aTrumpPenalty !== bTrumpPenalty) {
        return aTrumpPenalty - bTrumpPenalty;
      }
      return getCardRankValue(a) - getCardRankValue(b);
    });
    return preferredWin[0];
  }

  if (winningCards.length > 0 && leaderThreat) {
    const trumpWinners = winningCards.filter((card) => isTrumpCard(card, trumpSuit));
    if (trumpWinners.length > 0) {
      return trumpWinners.sort((a, b) => getCardRankValue(a) - getCardRankValue(b))[0];
    }
    return winningCards.sort((a, b) => getCardRankValue(a) - getCardRankValue(b))[0];
  }

  if (winningCards.length > 0) {
    const candidateScores = winningCards.map((card) => {
      let score = 30;
      if (!isTrumpCard(card, trumpSuit)) {
        score += 12;
      }
      if (isShortRound) {
        score += 8;
      }
      score -= getCardRankValue(card) * (isTrumpCard(card, trumpSuit) ? 1.2 : 0.8);
      if (difficulty !== "hard") {
        score -= Math.random() * 18;
      }
      return { card, score };
    });

    candidateScores.sort((a, b) => b.score - a.score || getCardRankValue(a.card) - getCardRankValue(b.card));
    return candidateScores[0].card;
  }

  const nonTrumpCards = legalCards.filter((card) => !isTrumpCard(card, trumpSuit));
  if (nonTrumpCards.length > 0) {
    return chooseDiscardCard(nonTrumpCards, aiHand.cards, trumpSuit);
  }

  return chooseLowestCard(legalCards, trumpSuit);
};

const chooseAiPlayableCard = (game: Game, aiPlayerId: string, token: string): Card => {
  const difficulty = game.options.aiDifficulty ?? "medium";
  if (difficulty === "easy") {
    return chooseBasicPlayableCard(game, aiPlayerId, token);
  }

  return chooseStrategicPlayableCard(game, aiPlayerId, token);
};

export const applyAutomationStep = (game: Game): Game | undefined => {
  return applyAutomationStepForPlayer(game);
};

export const applyAutomationStepForPlayer = (
  game: Game,
  controlledPlayerId?: string,
): Game | undefined => {
  if (game.phase.stage === "Scoring") {
    return withNextVersion(game, {
      phase: advancePhase(game),
    });
  }

  if (game.phase.stage === "EndOfRound") {
    if (Date.now() < game.phase.advanceAfter) {
      return undefined;
    }

    return withNextVersion(game, {
      phase: advancePhase(game),
    });
  }

  const aiTurn = getAutomatedTurnPlayer(game, controlledPlayerId);
  if (!aiTurn) {
    return undefined;
  }

  if (game.phase.stage === "Dealing") {
    const event: LambdaEventPayload<"dealCards"> = {
      action: "dealCards",
      payload: {
        gameId: game.id,
        playerToken: aiTurn.token,
      },
    };
    return dealCards(game, event);
  }

  if (game.phase.stage === "Bidding") {
    const aiBid = chooseAiBid(game);
    const event: LambdaEventPayload<"submitBid"> = {
      action: "submitBid",
      payload: {
        gameId: game.id,
        playerToken: aiTurn.token,
        bid: aiBid.bid,
        ...(typeof aiBid.trip === "boolean" ? { trip: aiBid.trip } : {}),
      },
    };
    return submitBid(game, event);
  }

  if (game.phase.stage === "Playing") {
    const card = chooseAiPlayableCard(game, aiTurn.playerId, aiTurn.token);
    const event: LambdaEventPayload<"playCard"> = {
      action: "playCard",
      payload: {
        gameId: game.id,
        playerToken: aiTurn.token,
        card,
      },
    };
    return playCard(game, event);
  }

  return undefined;
};

export const reviewGameState = (game: Game): Game => {
  let current = game;

  for (let step = 0; step < MAX_REVIEW_STEPS; step += 1) {
    const updatedGame = applyAutomationStep(current);
    if (!updatedGame) {
      return current;
    }
    current = updatedGame;
  }

  throw new Error("Game state review exceeded step limit");
};
