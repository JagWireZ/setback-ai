import type { Game } from "@shared/types/game";
import { TransactWriteItems } from "../../../../db";
import { withExpiration } from "./expiration";
import { tableName } from "./tableName";
import { toGameVersionItem } from "./gameVersionItem";

export const putGame = (game: Game): Promise<void> =>
  TransactWriteItems({
    items: [
      {
        put: {
          tableName: tableName(),
          item: withExpiration(game),
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
