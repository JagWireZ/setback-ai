import type { DealingPhase, BiddingPhase, Game, Phase, PlayingPhase } from "@shared/types/game";
import { getPlayerController } from "../player/presence";

export const DEFAULT_AI_TURN_DELAY_MS = 1500;

type TurnPhase = DealingPhase | BiddingPhase | PlayingPhase;

export const isTurnPhase = (phase: Phase): phase is TurnPhase =>
  "turnPlayerId" in phase;

export const isAutomatedTurnPlayer = (game: Game, playerId: string): boolean => {
  const player = game.players.find((entry) => entry.id === playerId);
  if (!player) {
    return false;
  }

  return player.type === "ai" || getPlayerController(player) === "ai-temporary";
};

const getComputedTurnDueAt = (
  phase: TurnPhase,
  delayMs: number = DEFAULT_AI_TURN_DELAY_MS,
): number => (phase.turnStartedAt ?? Date.now()) + delayMs;

export const withTurnDueAt = <TPhase extends Phase>(
  game: Game,
  phase: TPhase,
  delayMs: number = DEFAULT_AI_TURN_DELAY_MS,
): TPhase => {
  if (!isTurnPhase(phase)) {
    if (!("turnDueAt" in phase) || phase.turnDueAt === undefined) {
      return phase;
    }

    return {
      ...phase,
      turnDueAt: undefined,
    } as TPhase;
  }

  const nextTurnDueAt = isAutomatedTurnPlayer(game, phase.turnPlayerId)
    ? getComputedTurnDueAt(phase, delayMs)
    : undefined;

  if (phase.turnDueAt === nextTurnDueAt) {
    return phase;
  }

  return {
    ...phase,
    turnDueAt: nextTurnDueAt,
  } as TPhase;
};

export const normalizeTurnDueAt = (game: Game): Game => {
  const phase = withTurnDueAt(game, game.phase);
  return phase === game.phase
    ? game
    : {
        ...game,
        phase,
      };
};

export const setCurrentTurnDueAt = (game: Game, dueAt: number | undefined): Game => {
  if (!isTurnPhase(game.phase) || game.phase.turnDueAt === dueAt) {
    return game;
  }

  return {
    ...game,
    phase: {
      ...game.phase,
      turnDueAt: dueAt,
    },
  };
};

export const getAutomationDueAt = (game: Game): number | undefined => {
  if (game.phase.stage === "Scoring") {
    return Date.now();
  }

  if (game.phase.stage === "EndOfRound") {
    return game.phase.advanceAfter;
  }

  if (!isTurnPhase(game.phase) || !isAutomatedTurnPlayer(game, game.phase.turnPlayerId)) {
    return undefined;
  }

  return game.phase.turnDueAt ?? getComputedTurnDueAt(game.phase);
};
