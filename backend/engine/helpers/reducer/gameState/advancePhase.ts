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
      };
    case "Bidding":
      return {
        ...game.phase,
        stage: "Playing",
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
