import type { Game } from "@shared/types/game";

export const toPublicGameState = (
  game: Game,
): Omit<Game, "playerTokens" | "ownerToken"> => {
  const { playerTokens: _playerTokens, ownerToken: _ownerToken, ...publicGame } = game;
  return publicGame;
};
