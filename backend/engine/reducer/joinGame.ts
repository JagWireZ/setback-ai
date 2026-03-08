import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Game } from "@shared/types/game";
import { requireGame } from "../helpers/reducer/requireGame";
import { withNextVersion } from "../helpers/reducer/withNextVersion";
import { buildPlayer } from "../helpers/reducer/buildPlayer";
import { buildPlayerToken } from "../helpers/reducer/buildPlayerToken";
import { buildScore } from "../helpers/reducer/buildScore";

type JoinGameResult = {
  game: Game;
  playerToken: string;
};

export const joinGame = (
  game: Game | undefined,
  event: LambdaEventPayload<"joinGame">,
): JoinGameResult => {
  const existingGame = requireGame(game);
  if (existingGame.id !== event.payload.gameId) {
    throw new Error("Game ID mismatch");
  }

  const nextPlayer = buildPlayer(event.payload.playerName);
  const nextPlayerToken = buildPlayerToken(nextPlayer.id);
  const updatedGame = withNextVersion(existingGame, {
    players: [...existingGame.players, nextPlayer],
    playerTokens: [...existingGame.playerTokens, nextPlayerToken],
    playerOrder: [...existingGame.playerOrder, nextPlayer.id],
    scores: [...existingGame.scores, buildScore(nextPlayer.id)],
  });

  return {
    game: updatedGame,
    playerToken: nextPlayerToken.token,
  };
};
