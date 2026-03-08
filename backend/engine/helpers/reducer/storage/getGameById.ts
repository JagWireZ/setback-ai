import type { Game } from "@shared/types/game";
import { GetItem } from "../../../../db";
import { tableName } from "./tableName";

export const getGameById = (gameId: string): Promise<Game | undefined> =>
  GetItem<Game>({
    tableName: tableName(),
    key: { id: gameId },
  });
