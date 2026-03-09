import type { Game } from "@shared/types/game";
import { getGameById } from "../helpers/reducer/storage/getGameById";
import { putGame } from "../helpers/reducer/storage/putGame";
import { reviewGameState } from "./reviewGameState";

export const runAiTurnsForGame = async (gameId: string): Promise<Game | undefined> => {
  let game = await getGameById(gameId);
  if (!game) {
    return undefined;
  }

  const updatedGame = reviewGameState(game);
  if (updatedGame.version !== game.version) {
    await putGame(updatedGame);
  }

  game = updatedGame;
  return game;
};
