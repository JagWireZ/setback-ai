import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Game } from "@shared/types/game";
import { advanceDueAutomation } from "../ai/reviewGameState";
import { getGameById } from "../helpers/reducer/storage/getGameById";
import { getGameVersionById } from "../helpers/reducer/storage/getGameVersionById";
import { putGame } from "../helpers/reducer/storage/putGame";
import { normalizeTurnDueAt } from "../helpers/reducer/gameState/turnTiming";
import { requirePlayerToken } from "../helpers/reducer/validation/requirePlayerToken";
import { toResult } from "../helpers/reducer/gameState/toResult";

const reviewVisibleGame = async (
  existingGame: Game,
  playerToken: string,
  version: number,
): Promise<{ game?: Omit<Game, "playerTokens" | "ownerToken">; playerToken?: string; version?: number }> => {
  requirePlayerToken(existingGame, playerToken);

  const normalizedGame = normalizeTurnDueAt(existingGame);
  const reviewedGame = advanceDueAutomation(normalizedGame) ?? normalizedGame;
  if (reviewedGame.version !== existingGame.version) {
    await putGame(reviewedGame);
  } else if (reviewedGame !== existingGame) {
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
