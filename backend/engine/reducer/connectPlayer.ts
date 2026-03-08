import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Game } from "@shared/types/game";
import { requireGame } from "../helpers/reducer/validation/requireGame";
import { withNextVersion } from "../helpers/reducer/gameState/withNextVersion";

export const connectPlayer = (
  game: Game | undefined,
  event: LambdaEventPayload<"connectPlayer">,
): Game => {
  const existingGame = requireGame(game);
  const playerTokenEntry = existingGame.playerTokens.find(
    (entry) => entry.token === event.payload.playerToken,
  );
  if (!playerTokenEntry) {
    throw new Error("Invalid player token");
  }

  return withNextVersion(existingGame, {
    players: existingGame.players.map((player) =>
      player.id === playerTokenEntry.playerId ? { ...player, type: "human" } : player,
    ),
  });
};
