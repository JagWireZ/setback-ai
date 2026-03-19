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
import { requirePlayerTokenEntry } from "./helpers/reducer/validation/actionContext";
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
type OwnerActionName = OwnerActionEvent["action"];
type PlayerActionName = PlayerActionEvent["action"];

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
  const playerId = requirePlayerTokenEntry(existingGame, event.payload.playerToken).playerId;

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

const OWNER_ACTION_REDUCERS: Record<
  OwnerActionName,
  (game: Game | undefined, event: OwnerActionEvent) => Game
> = {
  addSeat: (currentGame, currentEvent) => addSeat(currentGame, currentEvent as LambdaEventPayload<"addSeat">),
  removeSeat: (currentGame, currentEvent) => removeSeat(currentGame, currentEvent as LambdaEventPayload<"removeSeat">),
  startGame: (currentGame, currentEvent) => startGame(currentGame, currentEvent as LambdaEventPayload<"startGame">),
  startOver: (currentGame, currentEvent) => startOver(currentGame, currentEvent as LambdaEventPayload<"startOver">),
  movePlayer: (currentGame, currentEvent) => movePlayer(currentGame, currentEvent as LambdaEventPayload<"movePlayer">),
  setPlayerAway: (currentGame, currentEvent) => setPlayerAway(currentGame, currentEvent as LambdaEventPayload<"setPlayerAway">),
  coverAwayPlayerTurn: (currentGame, currentEvent) =>
    coverAwayPlayerTurn(currentGame, currentEvent as LambdaEventPayload<"coverAwayPlayerTurn">),
};

const PLAYER_ACTION_REDUCERS: Record<
  PlayerActionName,
  (game: Game | undefined, event: PlayerActionEvent) => Game
> = {
  dealCards: (currentGame, currentEvent) => dealCards(currentGame, currentEvent as LambdaEventPayload<"dealCards">),
  submitBid: (currentGame, currentEvent) => submitBid(currentGame, currentEvent as LambdaEventPayload<"submitBid">),
  playCard: (currentGame, currentEvent) => playCard(currentGame, currentEvent as LambdaEventPayload<"playCard">),
  sortCards: (currentGame, currentEvent) => sortCards(currentGame, currentEvent as LambdaEventPayload<"sortCards">),
  renamePlayer: (currentGame, currentEvent) => renamePlayer(currentGame, currentEvent as LambdaEventPayload<"renamePlayer">),
  sendReaction: (currentGame, currentEvent) => sendReaction(currentGame, currentEvent as LambdaEventPayload<"sendReaction">),
  returnFromAway: (currentGame, currentEvent) =>
    returnFromAway(currentGame, currentEvent as LambdaEventPayload<"returnFromAway">),
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
    case "removePlayer":
      return runOwnerOrSelfRemovePlayer(game, event);
    case "removeGame":
      return removeGame(event);
    case "getGameState":
      return getGameState(game, event);
    default:
      if (event.action in OWNER_ACTION_REDUCERS) {
        const action = event.action as OwnerActionName;
        return runOwnerAction(game, event as OwnerActionEvent, OWNER_ACTION_REDUCERS[action]);
      }

      if (event.action in PLAYER_ACTION_REDUCERS) {
        const action = event.action as PlayerActionName;
        return runPlayerAction(game, event as PlayerActionEvent, PLAYER_ACTION_REDUCERS[action]);
      }

      return Promise.resolve(assertNever(event as never));
  }
};
