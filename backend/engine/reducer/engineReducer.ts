import type { Game } from "@shared/types/game";
import type { LambdaEventPayload } from "@shared/types/lambda";
import { createGame } from "./createGame";
import { joinGame } from "./joinGame";
import { setOptions } from "./setOptions";
import { startGame } from "./startGame";
import { movePlayer } from "./movePlayer";
import { removePlayer } from "./removePlayer";
import { getGameState } from "./getGameState";
import { removeGame } from "./removeGame";
import { requireOwnerToken } from "../helpers/reducer/validation/requireOwnerToken";
import { requireVersion } from "../helpers/reducer/validation/requireVersion";
import { requirePlayerToken } from "../helpers/reducer/validation/requirePlayerToken";
import { requireGame } from "../helpers/reducer/validation/requireGame";
import { putGame } from "../helpers/reducer/storage/putGame";
import { toResult } from "../helpers/reducer/gameState/toResult";
import { assertNever } from "../helpers/reducer/core/assertNever";

export type PublicGameState = Omit<Game, "playerTokens" | "ownerToken">;

export type EngineReducerResult = {
  game?: PublicGameState;
  playerToken?: string;
};

export const engineReducer = (
  game: Game | undefined,
  event: LambdaEventPayload,
): Promise<EngineReducerResult> => {
  switch (event.action) {
    case "createGame": {
      const created = createGame(event);
      return putGame(created.game).then(() => toResult(created.game, created.playerToken));
    }
    case "joinGame": {
      const joined = joinGame(game, event);
      return putGame(joined.game).then(() => toResult(joined.game, joined.playerToken));
    }
    case "setOptions": {
      requireOwnerToken(game, event.payload.playerToken);
      requireVersion(game, event.payload.version);
      const updatedGame = setOptions(game, event);
      return putGame(updatedGame).then(() => toResult(updatedGame));
    }
    case "startGame": {
      requireOwnerToken(game, event.payload.playerToken);
      requireVersion(game, event.payload.version);
      const updatedGame = startGame(game, event);
      return putGame(updatedGame).then(() => toResult(updatedGame));
    }
    case "dealCards":
    case "submitBid":
    case "playCard": {
      requirePlayerToken(game, event.payload.playerToken);
      requireVersion(game, event.payload.version);
      const existingGame = requireGame(game);
      return putGame(existingGame).then(() => toResult(existingGame));
    }
    case "movePlayer": {
      requireOwnerToken(game, event.payload.playerToken);
      requireVersion(game, event.payload.version);
      const updatedGame = movePlayer(game, event);
      return putGame(updatedGame).then(() => toResult(updatedGame));
    }
    case "removePlayer": {
      requireOwnerToken(game, event.payload.playerToken);
      requireVersion(game, event.payload.version);
      const updatedGame = removePlayer(game, event);
      return putGame(updatedGame).then(() => toResult(updatedGame));
    }
    case "removeGame":
      return removeGame(event);
    case "reconnectPlayer": {
      requirePlayerToken(game, event.payload.playerToken);
      requireVersion(game, event.payload.version);
      const existingGame = requireGame(game);
      return putGame(existingGame).then(() => toResult(existingGame));
    }
    case "getGameState":
      return getGameState(game, event);
    default:
      return Promise.resolve(assertNever(event));
  }
};
