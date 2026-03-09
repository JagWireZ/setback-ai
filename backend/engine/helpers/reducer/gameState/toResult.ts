import type { Game } from "@shared/types/game";
import { toPublicGameState } from "./toPublicGameState";

export const toResult = (
  game: Game,
  playerToken?: string,
  viewerPlayerToken?: string,
): { game?: Omit<Game, "playerTokens" | "ownerToken">; playerToken?: string } => ({
  game: toPublicGameState(game, viewerPlayerToken ?? playerToken),
  playerToken,
});
