import type { Game } from "@shared/types/game";
import type { LambdaEventPayload } from "@shared/types/lambda";
import { setPlayerPresence } from "../helpers/reducer/player/presence";
import { requireGameForAction } from "../helpers/reducer/validation/actionContext";

export const setPlayerAway = (
  game: Game | undefined,
  event: LambdaEventPayload<"setPlayerAway">,
): Game => {
  const existingGame = requireGameForAction(game, event);

  const player = existingGame.players.find((entry) => entry.id === event.payload.playerId);
  if (!player) {
    throw new Error("Player not found");
  }

  if (player.type !== "human") {
    throw new Error("Only human players can be marked away");
  }

  const ownerPlayerId = existingGame.playerTokens.find(
    (entry) => entry.token === existingGame.ownerToken,
  )?.playerId;
  if (ownerPlayerId && player.id === ownerPlayerId) {
    throw new Error("Owner cannot be marked away from the owner controls");
  }

  return setPlayerPresence(existingGame, player.id, {
    away: true,
    connected: false,
  });
};
