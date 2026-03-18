import type { Game } from "@shared/types/game";
import type { LambdaEventPayload } from "@shared/types/lambda";
import { createGame } from "./reducer/createGame";
import { joinGame } from "./reducer/joinGame";
import { checkState } from "./reducer/checkState";
import { addSeat } from "./reducer/addSeat";
import { removeSeat } from "./reducer/removeSeat";
import { startGame } from "./reducer/startGame";
import { startOver } from "./reducer/startOver";
import { movePlayer } from "./reducer/movePlayer";
import { getGameState } from "./reducer/getGameState";
import { removeGame } from "./reducer/removeGame";
import { removePlayer } from "./reducer/removePlayer";
import { setPlayerAway } from "./reducer/setPlayerAway";
import { returnFromAway } from "./reducer/returnFromAway";
import { renamePlayer } from "./reducer/renamePlayer";
import { sendReaction } from "./reducer/sendReaction";
import { dealCards } from "./reducer/dealCards";
import { submitBid } from "./reducer/submitBid";
import { playCard } from "./reducer/playCard";
import { coverAwayPlayerTurn } from "./reducer/coverAwayPlayerTurn";
import { sortCards } from "./reducer/sortCards";
import { requireOwnerToken } from "./helpers/reducer/validation/requireOwnerToken";
import { touchPlayerActivity } from "./helpers/reducer/player/touchPlayerActivity";
import { requirePlayerToken } from "./helpers/reducer/validation/requirePlayerToken";
import { requireGame } from "./helpers/reducer/validation/requireGame";
import { putGame } from "./helpers/reducer/storage/putGame";
import { toResult } from "./helpers/reducer/gameState/toResult";
import { normalizeTurnDueAt } from "./helpers/reducer/gameState/turnTiming";
import { assertNever } from "./helpers/reducer/core/assertNever";

export type PublicGameState = Omit<Game, "playerTokens" | "ownerToken">;

export type EngineReducerResult = {
  game?: PublicGameState;
  playerToken?: string;
  version?: number;
};

type OwnerActionEvent = LambdaEventPayload<
  "addSeat" | "removeSeat" | "startGame" | "startOver" | "movePlayer" | "setPlayerAway" | "coverAwayPlayerTurn"
>;
type PlayerActionEvent = LambdaEventPayload<
  "dealCards" | "submitBid" | "playCard" | "sortCards" | "renamePlayer" | "sendReaction" | "returnFromAway"
>;

const persistAndReturn = (
  updatedGame: Game,
  viewerPlayerToken: string,
): Promise<EngineReducerResult> =>
  putGame(normalizeTurnDueAt(updatedGame)).then(() =>
    toResult(normalizeTurnDueAt(updatedGame), undefined, viewerPlayerToken),
  );

const runOwnerAction = <TEvent extends OwnerActionEvent>(
  game: Game | undefined,
  event: TEvent,
  reducer: (game: Game | undefined, event: TEvent) => Game,
): Promise<EngineReducerResult> => {
  requireOwnerToken(game, event.payload.playerToken);
  return persistAndReturn(reducer(game, event), event.payload.playerToken);
};

const runPlayerAction = <TEvent extends PlayerActionEvent>(
  game: Game | undefined,
  event: TEvent,
  reducer: (game: Game | undefined, event: TEvent) => Game,
): Promise<EngineReducerResult> => {
  requirePlayerToken(game, event.payload.playerToken);
  const existingGame = requireGame(game);
  const playerId = existingGame.playerTokens.find(
    (entry) => entry.token === event.payload.playerToken,
  )?.playerId;
  if (!playerId) {
    throw new Error("Invalid player token");
  }

  const updatedGame = reducer(game, event);
  return persistAndReturn(touchPlayerActivity(updatedGame, playerId, { connected: true }), event.payload.playerToken);
};

const runOwnerOrSelfRemovePlayer = (
  game: Game | undefined,
  event: LambdaEventPayload<"removePlayer">,
): Promise<EngineReducerResult> => {
  requirePlayerToken(game, event.payload.playerToken);
  const existingGame = requireGame(game);
  const targetPlayerToken = existingGame.playerTokens.find(
    (entry) => entry.playerId === event.payload.playerId,
  )?.token;
  const isOwnerRequest = existingGame.ownerToken === event.payload.playerToken;
  const isSelfRemoval = targetPlayerToken === event.payload.playerToken;

  if (!isOwnerRequest && !isSelfRemoval) {
    throw new Error("Only the owner can remove other players");
  }

  return persistAndReturn(removePlayer(game, event), event.payload.playerToken);
};

export const engineReducer = (
  game: Game | undefined,
  event: LambdaEventPayload,
): Promise<EngineReducerResult> => {
  switch (event.action) {
    case "createGame": {
      const created = createGame(event);
      const normalizedGame = normalizeTurnDueAt(created.game);
      return putGame(normalizedGame).then(() =>
        toResult(normalizedGame, created.playerToken, created.playerToken),
      );
    }
    case "joinGame": {
      const joined = joinGame(game, event);
      const normalizedGame = normalizeTurnDueAt(joined.game);
      return putGame(normalizedGame).then(() =>
        toResult(normalizedGame, joined.playerToken, joined.playerToken),
      );
    }
    case "checkState": {
      requireOwnerToken(game, event.payload.playerToken);
      const existingGame = requireGame(game);
      const updatedGame = checkState(game, event);

      if (updatedGame.version !== existingGame.version || updatedGame !== existingGame) {
        return persistAndReturn(updatedGame, event.payload.playerToken);
      }

      return Promise.resolve(toResult(updatedGame, undefined, event.payload.playerToken));
    }
    case "addSeat":
      return runOwnerAction(game, event, addSeat);
    case "removeSeat":
      return runOwnerAction(game, event, removeSeat);
    case "startGame":
      return runOwnerAction(game, event, startGame);
    case "startOver":
      return runOwnerAction(game, event, startOver);
    case "dealCards":
      return runPlayerAction(game, event, dealCards);
    case "submitBid":
      return runPlayerAction(game, event, submitBid);
    case "playCard":
      return runPlayerAction(game, event, playCard);
    case "returnFromAway":
      return runPlayerAction(game, event, returnFromAway);
    case "coverAwayPlayerTurn":
      return runOwnerAction(game, event, coverAwayPlayerTurn);
    case "movePlayer":
      return runOwnerAction(game, event, movePlayer);
    case "setPlayerAway":
      return runOwnerAction(game, event, setPlayerAway);
    case "sortCards":
      return runPlayerAction(game, event, sortCards);
    case "removePlayer":
      return runOwnerOrSelfRemovePlayer(game, event);
    case "renamePlayer":
      return runPlayerAction(game, event, renamePlayer);
    case "sendReaction":
      return runPlayerAction(game, event, sendReaction);
    case "removeGame":
      return removeGame(event);
    case "getGameState":
      return getGameState(game, event);
    default:
      return Promise.resolve(assertNever(event));
  }
};
