import type { DealingPhase, Game, Phase } from "@shared/types/game";
import { shuffleCards } from "../../shuffleCards";
import { assertNever } from "../core/assertNever";

const buildDealingPhase = (game: Game, roundIndex: number): DealingPhase => {
  if (game.playerOrder.length === 0) {
    throw new Error("Cannot advance phase without players");
  }

  const deck = shuffleCards();
  const trump = deck.pop();
  if (!trump) {
    throw new Error("Cannot initialize dealing phase without cards");
  }

  const dealerPlayerId = game.playerOrder[roundIndex % game.playerOrder.length];
  return {
    stage: "Dealing",
    dealerPlayerId,
    turnPlayerId: dealerPlayerId,
    roundIndex,
    trickIndex: 0,
    bids: [],
    cards: {
      deck,
      trump,
      hands: game.playerOrder.map((playerId) => ({
        playerId,
        cards: [],
      })),
      completedTricks: [],
    },
  };
};

const getNextPlayerId = (playerOrder: string[], playerId: string): string => {
  const currentIndex = playerOrder.indexOf(playerId);
  if (currentIndex < 0) {
    throw new Error("Dealer player is not in player order");
  }

  return playerOrder[(currentIndex + 1) % playerOrder.length];
};

const getFirstPlayerAfterDealerWithHighestBid = (
  playerOrder: string[],
  dealerPlayerId: string,
  bids: { playerId: string; amount: number }[],
): string => {
  if (bids.length === 0) {
    throw new Error("Cannot enter playing phase without bids");
  }

  const maxBid = Math.max(...bids.map((bid) => bid.amount));
  const highestBidPlayerIds = new Set(
    bids.filter((bid) => bid.amount === maxBid).map((bid) => bid.playerId),
  );

  const dealerIndex = playerOrder.indexOf(dealerPlayerId);
  if (dealerIndex < 0) {
    throw new Error("Dealer player is not in player order");
  }

  for (let offset = 1; offset <= playerOrder.length; offset += 1) {
    const playerId = playerOrder[(dealerIndex + offset) % playerOrder.length];
    if (highestBidPlayerIds.has(playerId)) {
      return playerId;
    }
  }

  throw new Error("Highest bid player is not in player order");
};

export const advancePhase = (game: Game): Phase => {
  switch (game.phase.stage) {
    case "Lobby":
      if (game.options.rounds.length === 0) {
        throw new Error("Cannot advance phase without rounds configured");
      }
      return buildDealingPhase(game, 0);
    case "Dealing":
      return {
        ...game.phase,
        stage: "Bidding",
        turnPlayerId: getNextPlayerId(game.playerOrder, game.phase.dealerPlayerId),
      };
    case "Bidding":
      return {
        ...game.phase,
        stage: "Playing",
        turnPlayerId: getFirstPlayerAfterDealerWithHighestBid(
          game.playerOrder,
          game.phase.dealerPlayerId,
          game.phase.bids,
        ),
      };
    case "Playing": {
      const { turnPlayerId: _turnPlayerId, ...scoringPhase } = game.phase;
      return {
        ...scoringPhase,
        stage: "Scoring",
      };
    }
    case "Scoring": {
      const isLastRound = game.phase.roundIndex >= game.options.rounds.length - 1;
      return isLastRound ? { stage: "GameOver" } : buildDealingPhase(game, game.phase.roundIndex + 1);
    }
    case "GameOver":
      throw new Error("Cannot advance phase after game is over");
    default:
      return assertNever(game.phase);
  }
};
