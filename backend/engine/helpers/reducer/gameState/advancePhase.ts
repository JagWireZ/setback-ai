import type {
  BiddingPhase,
  DealingPhase,
  Game,
  Phase,
  PlayingPhase,
  ScoringPhase,
} from "@shared/types/game";
import { shuffleCards } from "../../../shuffleCards";
import { assertNever } from "../core/assertNever";

type RoundActionPhase = DealingPhase | BiddingPhase | PlayingPhase | ScoringPhase;

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

const toRoundActionPhase = (
  phase: RoundActionPhase,
  stage: "Bidding" | "Playing" | "Scoring",
): Phase => {
  if (stage === "Scoring") {
    const { turnPlayerId: _turnPlayerId, ...scoringPhase } = phase;
    return {
      ...scoringPhase,
      stage,
    };
  }

  return {
    ...phase,
    stage,
  };
};

export const advancePhase = (game: Game): Phase => {
  switch (game.phase.stage) {
    case "Lobby":
      if (game.options.rounds.length === 0) {
        throw new Error("Cannot advance phase without rounds configured");
      }
      return buildDealingPhase(game, 0);
    case "Dealing":
      return toRoundActionPhase(game.phase, "Bidding");
    case "Bidding":
      return toRoundActionPhase(game.phase, "Playing");
    case "Playing":
      return toRoundActionPhase(game.phase, "Scoring");
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
