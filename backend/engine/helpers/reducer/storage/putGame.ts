import type { Game } from "@shared/types/game";
import { TransactWriteItems } from "../../../../db";
import { tableName } from "./tableName";
import { toGameVersionItem } from "./gameVersionItem";

export const putGame = (game: Game): Promise<void> =>
  TransactWriteItems({
    items: [
      {
        put: {
          tableName: tableName(),
          item: game,
        },
      },
      {
        put: {
          tableName: tableName(),
          item: toGameVersionItem(game),
        },
      },
    ],
  });
