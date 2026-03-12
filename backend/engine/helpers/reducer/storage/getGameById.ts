import type { Game } from "@shared/types/game";
import { GetItem } from "../../../../db";
import { normalizeGameId } from "../gameId/normalizeGameId";
import { tableName } from "./tableName";

export const getGameById = (gameId: string): Promise<Game | undefined> =>
  GetItem<Game>({
    tableName: tableName(),
    key: { id: normalizeGameId(gameId) },
  });
