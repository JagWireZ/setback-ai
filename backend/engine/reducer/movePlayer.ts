import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Game } from "@shared/types/game";
import { requireGame } from "../helpers/reducer/requireGame";
import { withNextVersion } from "../helpers/reducer/withNextVersion";

export const movePlayer = (
  game: Game | undefined,
  event: LambdaEventPayload<"movePlayer">,
): Game => {
  const existingGame = requireGame(game);
  if (existingGame.id !== event.payload.gameId) {
    throw new Error("Game ID mismatch");
  }

  const currentIndex = existingGame.playerOrder.indexOf(event.payload.playerId);
  if (currentIndex === -1) {
    throw new Error("Player not found in playerOrder");
  }

  const { direction } = event.payload;
  if (direction !== "left" && direction !== "right") {
    throw new Error('movePlayer direction must be "left" or "right"');
  }

  const total = existingGame.playerOrder.length;
  const nextIndex =
    direction === "left"
      ? (currentIndex - 1 + total) % total
      : (currentIndex + 1) % total;

  const nextOrder = [...existingGame.playerOrder];
  [nextOrder[currentIndex], nextOrder[nextIndex]] = [
    nextOrder[nextIndex],
    nextOrder[currentIndex],
  ];

  return withNextVersion(existingGame, {
    playerOrder: nextOrder,
  });
};
