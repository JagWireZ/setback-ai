import type { Game } from "@shared/types/game";
import { getGameById } from "../helpers/reducer/storage/getGameById";
import { putGame } from "../helpers/reducer/storage/putGame";
import { applyAutomationStep } from "./reviewGameState";

const MAX_AI_TURN_STEPS = 200;

type RunAiTurnsForGameOptions = {
  delayMs?: number;
  initialDelayMs?: number;
  onStep?: (game: Game) => Promise<void> | void;
};

const wait = async (delayMs: number): Promise<void> => {
  if (delayMs <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, delayMs));
};

export const runAiTurnsForGame = async (
  gameId: string,
  options: RunAiTurnsForGameOptions = {},
): Promise<Game | undefined> => {
  const delayMs = Math.max(0, Math.trunc(options.delayMs ?? 0));
  const initialDelayMs = Math.max(0, Math.trunc(options.initialDelayMs ?? delayMs));
  let game = await getGameById(gameId);
  if (!game) {
    return undefined;
  }

  for (let step = 0; step < MAX_AI_TURN_STEPS; step += 1) {
    const updatedGame = applyAutomationStep(game);
    if (!updatedGame) {
      return game;
    }

    if (step === 0) {
      await wait(initialDelayMs);
    }

    await putGame(updatedGame);
    await options.onStep?.(updatedGame);
    game = updatedGame;

    const hasMoreAutomation = Boolean(applyAutomationStep(game));
    if (hasMoreAutomation) {
      await wait(delayMs);
    }
  }

  throw new Error("AI turn runner exceeded step limit");
};
