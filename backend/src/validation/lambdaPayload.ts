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

const isCardCount = (value: unknown): value is CardCount =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 10;
