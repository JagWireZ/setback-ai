import type { LambdaEventPayload } from "@shared/types/lambda";
import { getGameById } from "../helpers/reducer/getGameById";
import { requireOwnerToken } from "../helpers/reducer/requireOwnerToken";
import { deleteGameById } from "../helpers/reducer/deleteGameById";

export const removeGame = (
  event: LambdaEventPayload<"removeGame">,
): Promise<{ game?: never; playerToken?: string }> =>
  getGameById(event.payload.gameId).then((existingGame) => {
    if (!existingGame) {
      throw new Error("Game not found");
    }

    requireOwnerToken(existingGame, event.payload.playerToken);

    return deleteGameById(event.payload.gameId).then(() => ({}));
  });
