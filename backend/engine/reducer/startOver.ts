import type { LambdaEventPayload } from "@shared/types/lambda";
import { buildScore } from "../helpers/reducer/player/buildScore";
import type { Game } from "@shared/types/game";
import { requireGame } from "../helpers/reducer/validation/requireGame";
import { withNextVersion } from "../helpers/reducer/gameState/withNextVersion";

export const startOver = (
  game: Game | undefined,
  event: LambdaEventPayload<"startOver">,
): Game => {
  const existingGame = requireGame(game);
  if (existingGame.id !== event.payload.gameId) {
    throw new Error("Game ID mismatch");
  }

  return withNextVersion(existingGame, {
    phase: { stage: "Lobby" },
    scores: existingGame.players.map((player) => buildScore(player.id)),
    reactions: [],
  });
};
