import type { Game } from "@shared/types/game";
import type { LambdaEventPayload } from "@shared/types/lambda";
import { createGame } from "./reducer/createGame";
import { joinGame } from "./reducer/joinGame";
import { setOptions } from "./reducer/setOptions";
import { startGame } from "./reducer/startGame";
import { movePlayer } from "./reducer/movePlayer";
import { removePlayer } from "./reducer/removePlayer";
import { getGameState } from "./reducer/getGameState";
import { removeGame } from "./reducer/removeGame";
import { dealCards } from "./reducer/dealCards";
import { submitBid } from "./reducer/submitBid";
import { playCard } from "./reducer/playCard";
import { connectPlayer } from "./reducer/connectPlayer";
import { disconnectPlayer } from "./reducer/disconnectPlayer";
import { requireOwnerToken } from "./helpers/reducer/validation/requireOwnerToken";
import { requireVersion } from "./helpers/reducer/validation/requireVersion";
import { requirePlayerToken } from "./helpers/reducer/validation/requirePlayerToken";
import { putGame } from "./helpers/reducer/storage/putGame";
import { toResult } from "./helpers/reducer/gameState/toResult";
import { assertNever } from "./helpers/reducer/core/assertNever";

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
    case "dealCards": {
      requirePlayerToken(game, event.payload.playerToken);
      requireVersion(game, event.payload.version);
      const updatedGame = dealCards(game, event);
      return putGame(updatedGame).then(() => toResult(updatedGame));
    }
    case "submitBid": {
      requirePlayerToken(game, event.payload.playerToken);
      requireVersion(game, event.payload.version);
      const updatedGame = submitBid(game, event);
      return putGame(updatedGame).then(() => toResult(updatedGame));
    }
    case "playCard": {
      requirePlayerToken(game, event.payload.playerToken);
      requireVersion(game, event.payload.version);
      const updatedGame = playCard(game, event);
      return putGame(updatedGame).then(() => toResult(updatedGame));
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
    case "connectPlayer": {
      requirePlayerToken(game, event.payload.playerToken);
      requireVersion(game, event.payload.version);
      const updatedGame = connectPlayer(game, event);
      return putGame(updatedGame).then(() => toResult(updatedGame));
    }
    case "disconnectPlayer": {
      requirePlayerToken(game, event.payload.playerToken);
      requireVersion(game, event.payload.version);
      const updatedGame = disconnectPlayer(game, event);
      return putGame(updatedGame).then(() => toResult(updatedGame));
    }
    case "getGameState":
      return getGameState(game, event);
    default:
      return Promise.resolve(assertNever(event));
  }
};
