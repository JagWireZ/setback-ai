import type { Game } from "@shared/types/game";
import { getGameById } from "../helpers/reducer/storage/getGameById";
import { putGame } from "../helpers/reducer/storage/putGame";
import { getAutomationDueAt, normalizeTurnDueAt, setCurrentTurnDueAt } from "../helpers/reducer/gameState/turnTiming";
import { advanceDueAutomation } from "./reviewGameState";

const MAX_AI_TURN_STEPS = 200;

type RunAiTurnsForGameOptions = {
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
  const initialDelayMs = typeof options.initialDelayMs === "number"
    ? Math.max(0, Math.trunc(options.initialDelayMs))
    : undefined;
  let initialDelayApplied = false;

  for (let step = 0; step < MAX_AI_TURN_STEPS; step += 1) {
    let game = await getGameById(gameId);
    if (!game) {
      return undefined;
    }

    const normalizedGame = normalizeTurnDueAt(game);
    if (normalizedGame !== game) {
      await putGame(normalizedGame);
      game = normalizedGame;
    }

    if (!initialDelayApplied && typeof initialDelayMs === "number") {
      const overriddenGame = setCurrentTurnDueAt(game, Date.now() + initialDelayMs);
      if (overriddenGame !== game) {
        await putGame(overriddenGame);
        game = overriddenGame;
      }
      initialDelayApplied = true;
    }

    const dueAt = getAutomationDueAt(game);
    if (typeof dueAt !== "number") {
      return game;
    }

    await wait(Math.max(0, dueAt - Date.now()));

    game = await getGameById(gameId);
    if (!game) {
      return undefined;
    }

    const refreshedGame = normalizeTurnDueAt(game);
    if (refreshedGame !== game) {
      await putGame(refreshedGame);
      game = refreshedGame;
    }

    const updatedGame = advanceDueAutomation(game);
    if (!updatedGame) {
      return game;
    }

    await putGame(updatedGame);
    await options.onStep?.(updatedGame);
  }

  throw new Error("AI turn runner exceeded step limit");
};
