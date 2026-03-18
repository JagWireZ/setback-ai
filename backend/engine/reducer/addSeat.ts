import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Game } from "@shared/types/game";
import { buildPlayerToken } from "../helpers/reducer/player/buildPlayerToken";
import { buildScore } from "../helpers/reducer/player/buildScore";
import { buildAiPlayer } from "../helpers/reducer/player/buildAiPlayer";
import { getBotName } from "../helpers/reducer/player/getBotName";
import { requireGame } from "../helpers/reducer/validation/requireGame";
import { withNextVersion } from "../helpers/reducer/gameState/withNextVersion";

export const addSeat = (
  game: Game | undefined,
  event: LambdaEventPayload<"addSeat">,
): Game => {
  const existingGame = requireGame(game);
  if (existingGame.id !== event.payload.gameId) {
    throw new Error("Game ID mismatch");
  }

  if (existingGame.phase.stage !== "Lobby") {
    throw new Error("Seats can only be added in the lobby");
  }

  const nextPlayer = buildAiPlayer(getBotName(existingGame.players.map((player) => player.name)));

  return withNextVersion(existingGame, {
    players: [...existingGame.players, nextPlayer],
    playerTokens: [...existingGame.playerTokens, buildPlayerToken(nextPlayer.id)],
    playerOrder: [...existingGame.playerOrder, nextPlayer.id],
    scores: [...existingGame.scores, buildScore(nextPlayer.id)],
  });
};
