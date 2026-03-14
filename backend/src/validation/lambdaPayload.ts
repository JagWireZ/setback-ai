import type { CardCount } from "@shared/types/game";
import type { LambdaAction, LambdaEventPayload } from "@shared/types/lambda";

const REACTION_EMOJIS = new Set(["😀", "😂", "😮", "😢", "😡", "👏", "🔥", "🎉"]);
const CARD_SUITS = new Set(["Clubs", "Diamonds", "Hearts", "Spades", "Joker"]);
const CARD_RANKS = new Set(["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "LJ", "BJ"]);

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

const requirePlayerToken = (value: unknown, action: string): void => {
  requireNonEmptyString(value, action, "playerToken");
};

const requireGameId = (value: unknown, action: string): void => {
  requireNonEmptyString(value, action, "gameId");
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

export function assertCreateGamePayload(
  event: LambdaEventPayload,
): asserts event is LambdaEventPayload<"createGame"> {
  const typedEvent = expectAction(event, "createGame");
  const { playerName, blindBid } = typedEvent.payload;

  requireNonEmptyString(playerName, typedEvent.action, "playerName");
  requireOptionalBoolean(blindBid, typedEvent.action, "blindBid");
}

export function assertRemoveGamePayload(
  event: LambdaEventPayload,
): asserts event is LambdaEventPayload<"removeGame"> {
  const typedEvent = expectAction(event, "removeGame");
  const { gameId, playerToken } = typedEvent.payload;

  requireGameId(gameId, typedEvent.action);
  requirePlayerToken(playerToken, typedEvent.action);
}

export function assertJoinGamePayload(
  event: LambdaEventPayload,
): asserts event is LambdaEventPayload<"joinGame"> {
  const typedEvent = expectAction(event, "joinGame");
  const { gameId, playerName } = typedEvent.payload;

  requireGameId(gameId, typedEvent.action);
  requireNonEmptyString(playerName, typedEvent.action, "playerName");
}

export function assertCheckStatePayload(
  event: LambdaEventPayload,
): asserts event is LambdaEventPayload<"checkState"> {
  const typedEvent = expectAction(event, "checkState");
  const { gameId, playerToken } = typedEvent.payload;

  requireGameId(gameId, typedEvent.action);
  requirePlayerToken(playerToken, typedEvent.action);
}

export function assertDealCardsPayload(
  event: LambdaEventPayload,
): asserts event is LambdaEventPayload<"dealCards"> {
  const typedEvent = expectAction(event, "dealCards");
  const { gameId, playerToken } = typedEvent.payload;

  requireGameId(gameId, typedEvent.action);
  requirePlayerToken(playerToken, typedEvent.action);
}

export function assertStartGamePayload(
  event: LambdaEventPayload,
): asserts event is LambdaEventPayload<"startGame"> {
  const typedEvent = expectAction(event, "startGame");
  const { gameId, playerToken, maxCards, dealerPlayerId } = typedEvent.payload;

  requireGameId(gameId, typedEvent.action);
  requirePlayerToken(playerToken, typedEvent.action);

  if (!isCardCount(maxCards)) {
    throw new Error("startGame requires payload.maxCards (1-10)");
  }

  requireOptionalNonEmptyString(dealerPlayerId, typedEvent.action, "dealerPlayerId");
}

export function assertStartOverPayload(
  event: LambdaEventPayload,
): asserts event is LambdaEventPayload<"startOver"> {
  const typedEvent = expectAction(event, "startOver");
  const { gameId, playerToken } = typedEvent.payload;

  requireGameId(gameId, typedEvent.action);
  requirePlayerToken(playerToken, typedEvent.action);
}

export function assertSubmitBidPayload(
  event: LambdaEventPayload,
): asserts event is LambdaEventPayload<"submitBid"> {
  const typedEvent = expectAction(event, "submitBid");
  const { gameId, playerToken, bid, trip } = typedEvent.payload;

  requireGameId(gameId, typedEvent.action);
  requirePlayerToken(playerToken, typedEvent.action);
  requireInteger(bid, typedEvent.action, "bid");
  requireOptionalBoolean(trip, typedEvent.action, "trip");
}

export function assertPlayCardPayload(
  event: LambdaEventPayload,
): asserts event is LambdaEventPayload<"playCard"> {
  const typedEvent = expectAction(event, "playCard");
  const { gameId, playerToken, card } = typedEvent.payload;

  requireGameId(gameId, typedEvent.action);
  requirePlayerToken(playerToken, typedEvent.action);

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
}

export function assertSortCardsPayload(
  event: LambdaEventPayload,
): asserts event is LambdaEventPayload<"sortCards"> {
  const typedEvent = expectAction(event, "sortCards");
  const { gameId, playerToken, mode } = typedEvent.payload;

  requireGameId(gameId, typedEvent.action);
  requirePlayerToken(playerToken, typedEvent.action);

  if (mode !== "bySuit" && mode !== "byRank") {
    throw new Error('sortCards requires payload.mode as "bySuit" or "byRank"');
  }
}

export function assertMovePlayerPayload(
  event: LambdaEventPayload,
): asserts event is LambdaEventPayload<"movePlayer"> {
  const typedEvent = expectAction(event, "movePlayer");
  const { gameId, playerToken, playerId, direction } = typedEvent.payload;

  requireGameId(gameId, typedEvent.action);
  requirePlayerToken(playerToken, typedEvent.action);
  requireNonEmptyString(playerId, typedEvent.action, "playerId");

  if (direction !== "left" && direction !== "right") {
    throw new Error('movePlayer requires payload.direction as "left" or "right"');
  }
}

export function assertRemovePlayerPayload(
  event: LambdaEventPayload,
): asserts event is LambdaEventPayload<"removePlayer"> {
  const typedEvent = expectAction(event, "removePlayer");
  const { gameId, playerToken, playerId } = typedEvent.payload;

  requireGameId(gameId, typedEvent.action);
  requirePlayerToken(playerToken, typedEvent.action);
  requireNonEmptyString(playerId, typedEvent.action, "playerId");
}

export function assertRenamePlayerPayload(
  event: LambdaEventPayload,
): asserts event is LambdaEventPayload<"renamePlayer"> {
  const typedEvent = expectAction(event, "renamePlayer");
  const { gameId, playerToken, playerName } = typedEvent.payload;

  requireGameId(gameId, typedEvent.action);
  requirePlayerToken(playerToken, typedEvent.action);
  requireNonEmptyString(playerName, typedEvent.action, "playerName");
}

export function assertSendReactionPayload(
  event: LambdaEventPayload,
): asserts event is LambdaEventPayload<"sendReaction"> {
  const typedEvent = expectAction(event, "sendReaction");
  const { gameId, playerToken, emoji } = typedEvent.payload;

  requireGameId(gameId, typedEvent.action);
  requirePlayerToken(playerToken, typedEvent.action);

  if (typeof emoji !== "string" || !REACTION_EMOJIS.has(emoji)) {
    throw new Error("sendReaction requires payload.emoji");
  }
}

export function assertGetGameStatePayload(
  event: LambdaEventPayload,
): asserts event is LambdaEventPayload<"getGameState"> {
  const typedEvent = expectAction(event, "getGameState");
  const { gameId, playerToken, version } = typedEvent.payload;

  requireGameId(gameId, typedEvent.action);
  requirePlayerToken(playerToken, typedEvent.action);
  requireInteger(version, typedEvent.action, "version");
}

const isCardCount = (value: unknown): value is CardCount =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 10;
