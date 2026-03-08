import type { LambdaEventPayload } from "@shared/types/lambda";
import { getGameById } from "../helpers/reducer/storage/getGameById";
import { requireOwnerToken } from "../helpers/reducer/validation/requireOwnerToken";
import { deleteGameById } from "../helpers/reducer/storage/deleteGameById";

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
