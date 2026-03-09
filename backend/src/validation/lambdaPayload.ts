import type { CardCount } from "@shared/types/game";
import type { LambdaEventPayload } from "@shared/types/lambda";

export function assertCreateGamePayload(
  event: LambdaEventPayload,
): asserts event is LambdaEventPayload<"createGame"> {
  if (event.action !== "createGame") {
    throw new Error("Invalid action for createGame payload validation");
  }

  const { playerName, maxCards, blindBid } = event.payload;

  if (typeof playerName !== "string" || playerName.trim().length === 0) {
    throw new Error("createGame requires payload.playerName");
  }

  if (!isCardCount(maxCards)) {
    throw new Error("createGame requires payload.maxCards (1-10)");
  }

  if (typeof blindBid !== "undefined" && typeof blindBid !== "boolean") {
    throw new Error("createGame payload.blindBid must be a boolean when provided");
  }
}

export function assertRemoveGamePayload(
  event: LambdaEventPayload,
): asserts event is LambdaEventPayload<"removeGame"> {
  if (event.action !== "removeGame") {
    throw new Error("Invalid action for removeGame payload validation");
  }

  const { gameId, playerToken } = event.payload;

  if (typeof gameId !== "string" || gameId.trim().length === 0) {
    throw new Error("removeGame requires payload.gameId");
  }

  if (typeof playerToken !== "string" || playerToken.trim().length === 0) {
    throw new Error("removeGame requires payload.playerToken");
  }
}

export function assertJoinGamePayload(
  event: LambdaEventPayload,
): asserts event is LambdaEventPayload<"joinGame"> {
  if (event.action !== "joinGame") {
    throw new Error("Invalid action for joinGame payload validation");
  }

  const { gameId, playerName } = event.payload;

  if (typeof gameId !== "string" || gameId.trim().length === 0) {
    throw new Error("joinGame requires payload.gameId");
  }

  if (typeof playerName !== "string" || playerName.trim().length === 0) {
    throw new Error("joinGame requires payload.playerName");
  }
}

export function assertCheckStatePayload(
  event: LambdaEventPayload,
): asserts event is LambdaEventPayload<"checkState"> {
  if (event.action !== "checkState") {
    throw new Error("Invalid action for checkState payload validation");
  }

  const { gameId, playerToken } = event.payload;

  if (typeof gameId !== "string" || gameId.trim().length === 0) {
    throw new Error("checkState requires payload.gameId");
  }

  if (typeof playerToken !== "string" || playerToken.trim().length === 0) {
    throw new Error("checkState requires payload.playerToken");
  }
}

export function assertDealCardsPayload(
  event: LambdaEventPayload,
): asserts event is LambdaEventPayload<"dealCards"> {
  if (event.action !== "dealCards") {
    throw new Error("Invalid action for dealCards payload validation");
  }

  const { gameId, playerToken } = event.payload;

  if (typeof gameId !== "string" || gameId.trim().length === 0) {
    throw new Error("dealCards requires payload.gameId");
  }

  if (typeof playerToken !== "string" || playerToken.trim().length === 0) {
    throw new Error("dealCards requires payload.playerToken");
  }

}

export function assertStartGamePayload(
  event: LambdaEventPayload,
): asserts event is LambdaEventPayload<"startGame"> {
  if (event.action !== "startGame") {
    throw new Error("Invalid action for startGame payload validation");
  }

  const { gameId, playerToken } = event.payload;

  if (typeof gameId !== "string" || gameId.trim().length === 0) {
    throw new Error("startGame requires payload.gameId");
  }

  if (typeof playerToken !== "string" || playerToken.trim().length === 0) {
    throw new Error("startGame requires payload.playerToken");
  }

}

export function assertSubmitBidPayload(
  event: LambdaEventPayload,
): asserts event is LambdaEventPayload<"submitBid"> {
  if (event.action !== "submitBid") {
    throw new Error("Invalid action for submitBid payload validation");
  }

  const { gameId, playerToken, bid, trip } = event.payload;

  if (typeof gameId !== "string" || gameId.trim().length === 0) {
    throw new Error("submitBid requires payload.gameId");
  }

  if (typeof playerToken !== "string" || playerToken.trim().length === 0) {
    throw new Error("submitBid requires payload.playerToken");
  }

  if (typeof bid !== "number" || !Number.isInteger(bid)) {
    throw new Error("submitBid requires payload.bid");
  }

  if (typeof trip !== "undefined" && typeof trip !== "boolean") {
    throw new Error("submitBid payload.trip must be a boolean when provided");
  }
}

const CARD_SUITS = new Set(["Clubs", "Diamonds", "Hearts", "Spades", "Joker"]);
const CARD_RANKS = new Set(["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "LJ", "BJ"]);

export function assertPlayCardPayload(
  event: LambdaEventPayload,
): asserts event is LambdaEventPayload<"playCard"> {
  if (event.action !== "playCard") {
    throw new Error("Invalid action for playCard payload validation");
  }

  const { gameId, playerToken, card } = event.payload;

  if (typeof gameId !== "string" || gameId.trim().length === 0) {
    throw new Error("playCard requires payload.gameId");
  }

  if (typeof playerToken !== "string" || playerToken.trim().length === 0) {
    throw new Error("playCard requires payload.playerToken");
  }

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

export function assertMovePlayerPayload(
  event: LambdaEventPayload,
): asserts event is LambdaEventPayload<"movePlayer"> {
  if (event.action !== "movePlayer") {
    throw new Error("Invalid action for movePlayer payload validation");
  }

  const { gameId, playerToken, playerId, direction } = event.payload;

  if (typeof gameId !== "string" || gameId.trim().length === 0) {
    throw new Error("movePlayer requires payload.gameId");
  }

  if (typeof playerToken !== "string" || playerToken.trim().length === 0) {
    throw new Error("movePlayer requires payload.playerToken");
  }

  if (typeof playerId !== "string" || playerId.trim().length === 0) {
    throw new Error("movePlayer requires payload.playerId");
  }

  if (direction !== "left" && direction !== "right") {
    throw new Error('movePlayer requires payload.direction as "left" or "right"');
  }
}

export function assertGetGameStatePayload(
  event: LambdaEventPayload,
): asserts event is LambdaEventPayload<"getGameState"> {
  if (event.action !== "getGameState") {
    throw new Error("Invalid action for getGameState payload validation");
  }

  const { gameId, playerToken, version } = event.payload;

  if (typeof gameId !== "string" || gameId.trim().length === 0) {
    throw new Error("getGameState requires payload.gameId");
  }

  if (typeof playerToken !== "string" || playerToken.trim().length === 0) {
    throw new Error("getGameState requires payload.playerToken");
  }

  if (typeof version !== "number" || !Number.isInteger(version)) {
    throw new Error("getGameState requires payload.version");
  }
}

const isCardCount = (value: unknown): value is CardCount =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 10;
