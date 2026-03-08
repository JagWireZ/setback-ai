import type { Game } from "@shared/types/game";
import { PutItem } from "../../../../db";
import { tableName } from "./tableName";

export const putGame = (game: Game): Promise<void> =>
  PutItem<Game>({
    tableName: tableName(),
    item: game,
  });
