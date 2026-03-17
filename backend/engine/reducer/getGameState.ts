import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Game } from "@shared/types/game";
import { reviewGameState } from "../ai/reviewGameState";
import { getGameById } from "../helpers/reducer/storage/getGameById";
import { getGameVersionById } from "../helpers/reducer/storage/getGameVersionById";
import { putGame } from "../helpers/reducer/storage/putGame";
import { requirePlayerToken } from "../helpers/reducer/validation/requirePlayerToken";
import { toResult } from "../helpers/reducer/gameState/toResult";

const reviewVisibleGame = async (
  existingGame: Game,
  playerToken: string,
  version: number,
): Promise<{ game?: Omit<Game, "playerTokens" | "ownerToken">; playerToken?: string; version?: number }> => {
  requirePlayerToken(existingGame, playerToken);

  const reviewedGame = reviewGameState(existingGame);
  if (reviewedGame.version !== existingGame.version) {
    await putGame(reviewedGame);
  }

  if (version >= reviewedGame.version) {
    return { version: reviewedGame.version };
  }

  return toResult(reviewedGame, undefined, playerToken);
};

export const getGameState = (
  _game: Game | undefined,
  event: LambdaEventPayload<"getGameState">,
): Promise<{ game?: Omit<Game, "playerTokens" | "ownerToken">; playerToken?: string; version?: number }> =>
  getGameVersionById(event.payload.gameId).then((versionItem) => {
    if (!versionItem) {
      return getGameById(event.payload.gameId).then((existingGame) => {
        if (!existingGame) {
          throw new Error("Game not found");
        }

        return reviewVisibleGame(existingGame, event.payload.playerToken, event.payload.version);
      });
    }

    const hasPlayerToken = versionItem.playerTokens.some(
      (entry) => entry.token === event.payload.playerToken,
    );
    if (!hasPlayerToken) {
      throw new Error("Invalid player token");
    }

    return getGameById(event.payload.gameId).then((existingGame) => {
      if (!existingGame) {
        throw new Error("Game not found");
      }

      return reviewVisibleGame(existingGame, event.payload.playerToken, event.payload.version);
    });
  });
