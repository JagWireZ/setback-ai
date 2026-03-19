import type { AIDifficulty, CardCount } from "@shared/types/game";
import type { LambdaAction, LambdaEventPayload } from "@shared/types/lambda";
import { REACTION_EMOJIS, REACTION_PHRASES } from "../../../shared/types/reactions";

const REACTION_EMOJI_SET = new Set(REACTION_EMOJIS);
const REACTION_PHRASE_SET = new Set(REACTION_PHRASES);
const CARD_SUITS = new Set(["Clubs", "Diamonds", "Hearts", "Spades", "Joker"]);
const CARD_RANKS = new Set(["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "LJ", "BJ"]);
const AI_DIFFICULTIES = new Set<AIDifficulty>(["easy", "medium", "hard"]);

type PayloadAssertion<TAction extends LambdaAction> = (
  event: LambdaEventPayload,
) => asserts event is LambdaEventPayload<TAction>;

type PayloadRule<TAction extends LambdaAction> = (
  payload: LambdaEventPayload<TAction>["payload"],
  action: TAction,
) => void;

type PayloadValidatorMap = {
  [TAction in LambdaAction]: PayloadAssertion<TAction>;
};

const expectAction = <TAction extends LambdaAction>(
  event: LambdaEventPayload,
  action: TAction,
): LambdaEventPayload<TAction> => {
  if (event.action !== action) {
    throw new Error(`Invalid action for ${action} payload validation`);
  }

  return event as LambdaEventPayload<TAction>;
};

const requireNonEmptyString = (value: unknown, action: string, field: string): void => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${action} requires payload.${field}`);
  }
};

const requireInteger = (value: unknown, action: string, field: string): void => {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${action} requires payload.${field}`);
  }
};

const requireOptionalBoolean = (value: unknown, action: string, field: string): void => {
  if (typeof value !== "undefined" && typeof value !== "boolean") {
    throw new Error(`${action} payload.${field} must be a boolean when provided`);
  }
};

const requireOptionalNonEmptyString = (value: unknown, action: string, field: string): void => {
  if (typeof value !== "undefined" && (typeof value !== "string" || value.trim().length === 0)) {
    throw new Error(`${action} payload.${field} must be a non-empty string when provided`);
  }
};

const requireGameId = (payload: { gameId: unknown }, action: string): void => {
  requireNonEmptyString(payload.gameId, action, "gameId");
};

const requirePlayerToken = (payload: { playerToken: unknown }, action: string): void => {
  requireNonEmptyString(payload.playerToken, action, "playerToken");
};

const withPayloadRules = <TAction extends LambdaAction>(
  action: TAction,
  ...rules: Array<PayloadRule<TAction>>
): PayloadAssertion<TAction> =>
  function assertPayload(event): asserts event is LambdaEventPayload<TAction> {
    const typedEvent = expectAction(event, action);
    for (const rule of rules) {
      rule(typedEvent.payload, action);
    }
  };

const isCardCount = (value: unknown): value is CardCount =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 10;

export const assertCreateGamePayload: PayloadAssertion<"createGame"> = withPayloadRules(
  "createGame",
  (payload, action) => requireNonEmptyString(payload.playerName, action, "playerName"),
  (payload, action) => requireOptionalBoolean(payload.blindBid, action, "blindBid"),
);

export const assertRemoveGamePayload: PayloadAssertion<"removeGame"> = withPayloadRules(
  "removeGame",
  requireGameId,
  requirePlayerToken,
);

export const assertJoinGamePayload: PayloadAssertion<"joinGame"> = withPayloadRules(
  "joinGame",
  requireGameId,
  (payload, action) => requireNonEmptyString(payload.playerName, action, "playerName"),
);

export const assertCheckStatePayload: PayloadAssertion<"checkState"> = withPayloadRules(
  "checkState",
  requireGameId,
  requirePlayerToken,
  (payload, action) => requireOptionalBoolean(payload.associateConnection, action, "associateConnection"),
);

export const assertAddSeatPayload: PayloadAssertion<"addSeat"> = withPayloadRules(
  "addSeat",
  requireGameId,
  requirePlayerToken,
);

export const assertRemoveSeatPayload: PayloadAssertion<"removeSeat"> = withPayloadRules(
  "removeSeat",
  requireGameId,
  requirePlayerToken,
  (payload, action) => requireNonEmptyString(payload.playerId, action, "playerId"),
);

export const assertDealCardsPayload: PayloadAssertion<"dealCards"> = withPayloadRules(
  "dealCards",
  requireGameId,
  requirePlayerToken,
);

export const assertStartGamePayload: PayloadAssertion<"startGame"> = withPayloadRules(
  "startGame",
  requireGameId,
  requirePlayerToken,
  (payload) => {
    if (!isCardCount(payload.maxCards)) {
      throw new Error("startGame requires payload.maxCards (1-10)");
    }
  },
  (payload, action) => requireOptionalNonEmptyString(payload.dealerPlayerId, action, "dealerPlayerId"),
  (payload) => {
    if (typeof payload.aiDifficulty !== "undefined" && !AI_DIFFICULTIES.has(payload.aiDifficulty)) {
      throw new Error('startGame payload.aiDifficulty must be "easy", "medium", or "hard"');
    }
  },
);

export const assertStartOverPayload: PayloadAssertion<"startOver"> = withPayloadRules(
  "startOver",
  requireGameId,
  requirePlayerToken,
);

export const assertSubmitBidPayload: PayloadAssertion<"submitBid"> = withPayloadRules(
  "submitBid",
  requireGameId,
  requirePlayerToken,
  (payload, action) => requireInteger(payload.bid, action, "bid"),
  (payload, action) => requireOptionalBoolean(payload.trip, action, "trip"),
);

export const assertPlayCardPayload: PayloadAssertion<"playCard"> = withPayloadRules(
  "playCard",
  requireGameId,
  requirePlayerToken,
  (payload) => {
    const { card } = payload;
    if (
      typeof card !== "object" ||
      card === null ||
      !("rank" in card) ||
      !("suit" in card) ||
      typeof card.rank !== "string" ||
      typeof card.suit !== "string" ||
      !CARD_RANKS.has(card.rank) ||
      !CARD_SUITS.has(card.suit)
    ) {
      throw new Error("playCard requires payload.card with valid rank and suit");
    }
  },
);

export const assertReturnFromAwayPayload: PayloadAssertion<"returnFromAway"> = withPayloadRules(
  "returnFromAway",
  requireGameId,
  requirePlayerToken,
);

export const assertCoverAwayPlayerTurnPayload: PayloadAssertion<"coverAwayPlayerTurn"> = withPayloadRules(
  "coverAwayPlayerTurn",
  requireGameId,
  requirePlayerToken,
  (payload, action) => requireNonEmptyString(payload.playerId, action, "playerId"),
);

export const assertSortCardsPayload: PayloadAssertion<"sortCards"> = withPayloadRules(
  "sortCards",
  requireGameId,
  requirePlayerToken,
  (payload) => {
    if (payload.mode !== "bySuit" && payload.mode !== "byRank") {
      throw new Error('sortCards requires payload.mode as "bySuit" or "byRank"');
    }
  },
);

export const assertMovePlayerPayload: PayloadAssertion<"movePlayer"> = withPayloadRules(
  "movePlayer",
  requireGameId,
  requirePlayerToken,
  (payload, action) => requireNonEmptyString(payload.playerId, action, "playerId"),
  (payload) => {
    if (payload.direction !== "left" && payload.direction !== "right") {
      throw new Error('movePlayer requires payload.direction as "left" or "right"');
    }
  },
);

export const assertSetPlayerAwayPayload: PayloadAssertion<"setPlayerAway"> = withPayloadRules(
  "setPlayerAway",
  requireGameId,
  requirePlayerToken,
  (payload, action) => requireNonEmptyString(payload.playerId, action, "playerId"),
);

export const assertRemovePlayerPayload: PayloadAssertion<"removePlayer"> = withPayloadRules(
  "removePlayer",
  requireGameId,
  requirePlayerToken,
  (payload, action) => requireNonEmptyString(payload.playerId, action, "playerId"),
);

export const assertRenamePlayerPayload: PayloadAssertion<"renamePlayer"> = withPayloadRules(
  "renamePlayer",
  requireGameId,
  requirePlayerToken,
  (payload, action) => requireNonEmptyString(payload.playerName, action, "playerName"),
);

export const assertSendReactionPayload: PayloadAssertion<"sendReaction"> = withPayloadRules(
  "sendReaction",
  requireGameId,
  requirePlayerToken,
  (payload) => {
    const hasEmoji = typeof payload.emoji === "string" && REACTION_EMOJI_SET.has(payload.emoji);
    const hasPhrase = typeof payload.phrase === "string" && REACTION_PHRASE_SET.has(payload.phrase);

    if (hasEmoji === hasPhrase) {
      throw new Error("sendReaction requires exactly one of payload.emoji or payload.phrase");
    }
  },
);

export const assertGetGameStatePayload: PayloadAssertion<"getGameState"> = withPayloadRules(
  "getGameState",
  requireGameId,
  requirePlayerToken,
  (payload, action) => requireInteger(payload.version, action, "version"),
  (payload, action) => requireOptionalBoolean(payload.associateConnection, action, "associateConnection"),
);

export const ACTION_PAYLOAD_VALIDATORS: PayloadValidatorMap = {
  createGame: assertCreateGamePayload,
  joinGame: assertJoinGamePayload,
  checkState: assertCheckStatePayload,
  addSeat: assertAddSeatPayload,
  removeSeat: assertRemoveSeatPayload,
  startGame: assertStartGamePayload,
  startOver: assertStartOverPayload,
  dealCards: assertDealCardsPayload,
  submitBid: assertSubmitBidPayload,
  playCard: assertPlayCardPayload,
  returnFromAway: assertReturnFromAwayPayload,
  coverAwayPlayerTurn: assertCoverAwayPlayerTurnPayload,
  sortCards: assertSortCardsPayload,
  movePlayer: assertMovePlayerPayload,
  setPlayerAway: assertSetPlayerAwayPayload,
  removePlayer: assertRemovePlayerPayload,
  renamePlayer: assertRenamePlayerPayload,
  sendReaction: assertSendReactionPayload,
  removeGame: assertRemoveGamePayload,
  getGameState: assertGetGameStatePayload,
};

export const validateLambdaPayload = <TAction extends LambdaAction>(
  event: LambdaEventPayload<TAction>,
): LambdaEventPayload<TAction> => {
  switch (event.action) {
    case "createGame":
      assertCreateGamePayload(event);
      break;
    case "joinGame":
      assertJoinGamePayload(event);
      break;
    case "checkState":
      assertCheckStatePayload(event);
      break;
    case "addSeat":
      assertAddSeatPayload(event);
      break;
    case "removeSeat":
      assertRemoveSeatPayload(event);
      break;
    case "startGame":
      assertStartGamePayload(event);
      break;
    case "startOver":
      assertStartOverPayload(event);
      break;
    case "dealCards":
      assertDealCardsPayload(event);
      break;
    case "submitBid":
      assertSubmitBidPayload(event);
      break;
    case "playCard":
      assertPlayCardPayload(event);
      break;
    case "returnFromAway":
      assertReturnFromAwayPayload(event);
      break;
    case "coverAwayPlayerTurn":
      assertCoverAwayPlayerTurnPayload(event);
      break;
    case "sortCards":
      assertSortCardsPayload(event);
      break;
    case "movePlayer":
      assertMovePlayerPayload(event);
      break;
    case "setPlayerAway":
      assertSetPlayerAwayPayload(event);
      break;
    case "removePlayer":
      assertRemovePlayerPayload(event);
      break;
    case "renamePlayer":
      assertRenamePlayerPayload(event);
      break;
    case "sendReaction":
      assertSendReactionPayload(event);
      break;
    case "removeGame":
      assertRemoveGamePayload(event);
      break;
    case "getGameState":
      assertGetGameStatePayload(event);
      break;
    default:
      throw new Error("Unhandled action");
  }

  return event;
};
