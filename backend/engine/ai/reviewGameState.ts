import type { Card, Game } from "@shared/types/game";
import type { LambdaEventPayload } from "@shared/types/lambda";
import { advancePhase } from "../helpers/reducer/gameState/advancePhase";
import { withNextVersion } from "../helpers/reducer/gameState/withNextVersion";
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

const getAiTurnPlayer = (game: Game): { playerId: string; token: string } | undefined => {
  if (!("turnPlayerId" in game.phase)) {
    return undefined;
  }

  const turnPlayerId = game.phase.turnPlayerId;
  const turnPlayer = game.players.find((player) => player.id === turnPlayerId);
  if (!turnPlayer || turnPlayer.type !== "ai") {
    return undefined;
  }

  return {
    playerId: turnPlayerId,
    token: getPlayerTokenById(game, turnPlayerId),
  };
};

const clampBid = (bid: number, cardCount: number): number =>
  Math.max(0, Math.min(cardCount, Math.trunc(bid)));

const getRankStrength = (card: Card): number => {
  if (card.rank === "BJ") {
    return 2.4;
  }
  if (card.rank === "LJ") {
    return 2.1;
  }

  const rankWeights: Record<string, number> = {
    A: 0.8,
    K: 0.65,
    Q: 0.5,
    J: 0.38,
    "10": 0.3,
    "9": 0.22,
    "8": 0.17,
    "7": 0.13,
    "6": 0.1,
    "5": 0.08,
    "4": 0.07,
    "3": 0.06,
    "2": 0.05,
  };

  return rankWeights[card.rank] ?? 0.05;
};

const getCardStrength = (card: Card, trumpSuit: Card["suit"]): number => {
  if (card.suit === "Joker") {
    return getRankStrength(card);
  }

  const rankStrength = getRankStrength(card);
  if (card.suit === trumpSuit) {
    return rankStrength + 0.5;
  }

  return rankStrength;
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

  const handStrength = aiHand.cards.reduce(
    (sum, card) => sum + getCardStrength(card, trumpSuit),
    0,
  );

  const estimatedTricks = clampBid(Math.round(handStrength / 1.2), round.cardCount);

  if (round.cardCount <= 3) {
    const strongForSweep = estimatedTricks === round.cardCount && handStrength >= round.cardCount + 0.8;
    if (strongForSweep) {
      return {
        bid: round.cardCount,
        trip: true,
      };
    }
  }

  return {
    bid: estimatedTricks,
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

const chooseAiPlayableCard = (game: Game, aiPlayerId: string, token: string): Card => {
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

const applyAutomationStep = (game: Game): Game | undefined => {
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

  const aiTurn = getAiTurnPlayer(game);
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
    const shouldPauseAfterStep =
      current.phase.stage === "Bidding" || current.phase.stage === "Playing";
    const updatedGame = applyAutomationStep(current);
    if (!updatedGame) {
      return current;
    }
    if (shouldPauseAfterStep) {
      return updatedGame;
    }
    current = updatedGame;
  }

  throw new Error("Game state review exceeded step limit");
};
