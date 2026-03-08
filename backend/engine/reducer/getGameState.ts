import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Game } from "@shared/types/game";
import { getGameById } from "../helpers/reducer/getGameById";
import { requirePlayerToken } from "../helpers/reducer/requirePlayerToken";
import { toResult } from "../helpers/reducer/toResult";

export const getGameState = (
  _game: Game | undefined,
  event: LambdaEventPayload<"getGameState">,
): Promise<{ game?: Omit<Game, "playerTokens" | "ownerToken">; playerToken?: string }> =>
  getGameById(event.payload.gameId).then((existingGame) => {
    if (!existingGame) {
      throw new Error("Game not found");
    }

    requirePlayerToken(existingGame, event.payload.playerToken);

    if (event.payload.version < existingGame.version) {
      return toResult(existingGame);
    }

    return {};
  });
