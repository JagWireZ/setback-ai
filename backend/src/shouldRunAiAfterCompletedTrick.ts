import type { Game } from "@shared/types/game";

export const shouldRunAiAfterCompletedTrick = (game: Game): boolean => {
  if (game.phase.stage !== "Playing") {
    return false;
  }

  const { turnPlayerId } = game.phase;
  const turnPlayer = game.players.find((player) => player.id === turnPlayerId);
  return turnPlayer?.type === "ai";
};
