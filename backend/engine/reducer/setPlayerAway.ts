import type { Game } from "@shared/types/game";
import type { LambdaEventPayload } from "@shared/types/lambda";
import { setPlayerPresence } from "../helpers/reducer/player/presence";
import { requireGame } from "../helpers/reducer/validation/requireGame";

export const setPlayerAway = (
  game: Game | undefined,
  event: LambdaEventPayload<"setPlayerAway">,
): Game => {
  const existingGame = requireGame(game);
  if (existingGame.id !== event.payload.gameId) {
    throw new Error("Game ID mismatch");
  }

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
