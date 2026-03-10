import type { Game } from "@shared/types/game";
import type { LambdaEventPayload } from "@shared/types/lambda";
import { createGame } from "./reducer/createGame";
import { joinGame } from "./reducer/joinGame";
import { checkState } from "./reducer/checkState";
import { startGame } from "./reducer/startGame";
import { movePlayer } from "./reducer/movePlayer";
import { getGameState } from "./reducer/getGameState";
import { removeGame } from "./reducer/removeGame";
import { removePlayer } from "./reducer/removePlayer";
import { dealCards } from "./reducer/dealCards";
import { submitBid } from "./reducer/submitBid";
import { playCard } from "./reducer/playCard";
import { sortCards } from "./reducer/sortCards";
import { requireOwnerToken } from "./helpers/reducer/validation/requireOwnerToken";
import { requirePlayerToken } from "./helpers/reducer/validation/requirePlayerToken";
import { requireGame } from "./helpers/reducer/validation/requireGame";
import { putGame } from "./helpers/reducer/storage/putGame";
import { toResult } from "./helpers/reducer/gameState/toResult";
import { assertNever } from "./helpers/reducer/core/assertNever";

export type PublicGameState = Omit<Game, "playerTokens" | "ownerToken">;

export type EngineReducerResult = {
  game?: PublicGameState;
  playerToken?: string;
  version?: number;
};

export const engineReducer = (
  game: Game | undefined,
  event: LambdaEventPayload,
): Promise<EngineReducerResult> => {
  switch (event.action) {
    case "createGame": {
      const created = createGame(event);
      return putGame(created.game).then(() =>
        toResult(created.game, created.playerToken, created.playerToken),
      );
    }
    case "joinGame": {
      const joined = joinGame(game, event);
      return putGame(joined.game).then(() =>
        toResult(joined.game, joined.playerToken, joined.playerToken),
      );
    }
    case "checkState": {
      requireOwnerToken(game, event.payload.playerToken);
      const existingGame = requireGame(game);
      const updatedGame = checkState(game, event);

      if (updatedGame.version !== existingGame.version) {
        return putGame(updatedGame).then(() =>
          toResult(updatedGame, undefined, event.payload.playerToken),
        );
      }

      return Promise.resolve(toResult(updatedGame, undefined, event.payload.playerToken));
    }
    case "startGame": {
      requireOwnerToken(game, event.payload.playerToken);
      const updatedGame = startGame(game, event);
      return putGame(updatedGame).then(() => toResult(updatedGame, undefined, event.payload.playerToken));
    }
    case "dealCards": {
      requirePlayerToken(game, event.payload.playerToken);
      const updatedGame = dealCards(game, event);
      return putGame(updatedGame).then(() => toResult(updatedGame, undefined, event.payload.playerToken));
    }
    case "submitBid": {
      requirePlayerToken(game, event.payload.playerToken);
      const updatedGame = submitBid(game, event);
      return putGame(updatedGame).then(() => toResult(updatedGame, undefined, event.payload.playerToken));
    }
    case "playCard": {
      requirePlayerToken(game, event.payload.playerToken);
      const updatedGame = playCard(game, event);
      return putGame(updatedGame).then(() => toResult(updatedGame, undefined, event.payload.playerToken));
    }
    case "movePlayer": {
      requireOwnerToken(game, event.payload.playerToken);
      const updatedGame = movePlayer(game, event);
      return putGame(updatedGame).then(() => toResult(updatedGame, undefined, event.payload.playerToken));
    }
    case "sortCards": {
      requirePlayerToken(game, event.payload.playerToken);
      const updatedGame = sortCards(game, event);
      return putGame(updatedGame).then(() => toResult(updatedGame, undefined, event.payload.playerToken));
    }
    case "removePlayer": {
      requireOwnerToken(game, event.payload.playerToken);
      const updatedGame = removePlayer(game, event);
      return putGame(updatedGame).then(() => toResult(updatedGame, undefined, event.payload.playerToken));
    }
    case "removeGame":
      return removeGame(event);
    case "getGameState":
      return getGameState(game, event);
    default:
      return Promise.resolve(assertNever(event));
  }
};
