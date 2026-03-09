import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Game } from "@shared/types/game";
import { getGameById } from "../helpers/reducer/storage/getGameById";
import { getGameVersionById } from "../helpers/reducer/storage/getGameVersionById";
import { putGame } from "../helpers/reducer/storage/putGame";
import { requirePlayerToken } from "../helpers/reducer/validation/requirePlayerToken";
import { toResult } from "../helpers/reducer/gameState/toResult";

export const getGameState = (
  _game: Game | undefined,
  event: LambdaEventPayload<"getGameState">,
): Promise<{ game?: Omit<Game, "playerTokens" | "ownerToken">; playerToken?: string }> =>
  getGameVersionById(event.payload.gameId).then((versionItem) => {
    if (!versionItem) {
      return getGameById(event.payload.gameId).then((existingGame) => {
        if (!existingGame) {
          throw new Error("Game not found");
        }

        requirePlayerToken(existingGame, event.payload.playerToken);

        return putGame(existingGame).then(() => {
          if (event.payload.version >= existingGame.version) {
            return {};
          }

          return toResult(existingGame);
        });
      });
    }

    const hasPlayerToken = versionItem.playerTokens.some(
      (entry) => entry.token === event.payload.playerToken,
    );
    if (!hasPlayerToken) {
      throw new Error("Invalid player token");
    }

    if (event.payload.version >= versionItem.version) {
      return {};
    }

    return getGameById(event.payload.gameId).then((existingGame) => {
      if (!existingGame) {
        throw new Error("Game not found");
      }

      return toResult(existingGame);
    });
  });
