import type { Game } from "@shared/types/game";
import type { LambdaEventPayload } from "@shared/types/lambda";
import { applyAutomationStepForPlayer } from "../ai/reviewGameState";
import { getPlayerPresence, mapPlayerState } from "../helpers/reducer/player/presence";
import { requireGame } from "../helpers/reducer/validation/requireGame";

const IDLE_TURN_TIMEOUT_MS = 60_000;

export const coverAwayPlayerTurn = (
  game: Game | undefined,
  event: LambdaEventPayload<"coverAwayPlayerTurn">,
): Game => {
  const existingGame = requireGame(game);
  if (existingGame.id !== event.payload.gameId) {
    throw new Error("Game ID mismatch");
  }

  if (!("turnPlayerId" in existingGame.phase)) {
    throw new Error("There is no active turn to cover");
  }

  if (existingGame.phase.turnPlayerId !== event.payload.playerId) {
    throw new Error("Only the current turn player can be covered");
  }

  const player = existingGame.players.find((entry) => entry.id === event.payload.playerId);
  if (!player) {
    throw new Error("Player not found");
  }

  const ownerPlayerId = existingGame.playerTokens.find(
    (entry) => entry.token === existingGame.ownerToken,
  )?.playerId;
  if (ownerPlayerId && player.id === ownerPlayerId) {
    throw new Error("Owner cannot be covered by AI");
  }

  if (player.type !== "human") {
    throw new Error("Only human players can be covered");
  }

  const presence = getPlayerPresence(player);
  const isAway = presence.away;
  const turnStartedAt = existingGame.phase.turnStartedAt ?? 0;
  const idleSince = Math.max(presence.lastSeenAt ?? 0, turnStartedAt);
  const isIdleDuringTurn =
    idleSince > 0 &&
    Date.now() - idleSince >= IDLE_TURN_TIMEOUT_MS;
  if (!isAway && !isIdleDuringTurn) {
    throw new Error("Player must be away or idle on their turn before AI can cover");
  }

  const gameWithAwayPlayer = mapPlayerState(existingGame, player.id, (entry) => ({
    ...entry,
    presence: {
      ...getPlayerPresence(entry),
      away: true,
    },
    controller: "ai-temporary",
  }));
  const updatedGame = applyAutomationStepForPlayer(gameWithAwayPlayer, player.id);
  if (!updatedGame) {
    throw new Error("Unable to cover the current turn");
  }

  return mapPlayerState(updatedGame, player.id, (entry) => ({
    ...entry,
    controller: "human",
  }));
};
