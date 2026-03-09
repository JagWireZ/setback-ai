import type { CardCount } from "@shared/types/game";
import type { LambdaEventPayload } from "@shared/types/lambda";

export function assertCreateGamePayload(
  event: LambdaEventPayload,
): asserts event is LambdaEventPayload<"createGame"> {
  if (event.action !== "createGame") {
    throw new Error("Invalid action for createGame payload validation");
  }

  const { playerName, maxCards } = event.payload;

  if (typeof playerName !== "string" || playerName.trim().length === 0) {
    throw new Error("createGame requires payload.playerName");
  }

  if (!isCardCount(maxCards)) {
    throw new Error("createGame requires payload.maxCards (1-10)");
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

export function assertDealCardsPayload(
  event: LambdaEventPayload,
): asserts event is LambdaEventPayload<"dealCards"> {
  if (event.action !== "dealCards") {
    throw new Error("Invalid action for dealCards payload validation");
  }

  const { gameId, playerToken, version } = event.payload;

  if (typeof gameId !== "string" || gameId.trim().length === 0) {
    throw new Error("dealCards requires payload.gameId");
  }

  if (typeof playerToken !== "string" || playerToken.trim().length === 0) {
    throw new Error("dealCards requires payload.playerToken");
  }

  if (typeof version !== "number" || !Number.isInteger(version)) {
    throw new Error("dealCards requires payload.version");
  }
}

const isCardCount = (value: unknown): value is CardCount =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 10;
