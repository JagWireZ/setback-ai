import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Game, Player } from "@shared/types/game";
import { generateGameId } from "../helpers/generateGameId";
import { buildPlayer } from "../helpers/reducer/player/buildPlayer";
import { getBotName } from "../helpers/reducer/player/getBotName";
import { buildPlayerToken } from "../helpers/reducer/player/buildPlayerToken";
import { buildScore } from "../helpers/reducer/player/buildScore";

type CreateGameResult = {
  game: Game;
  playerToken: string;
};

export const createGame = (event: LambdaEventPayload<"createGame">): CreateGameResult => {
  const hostPlayer = {
    ...buildPlayer(event.payload.playerName),
    type: "human" as const,
  };
  const allPlayers: Player[] = [hostPlayer];

  for (let playerIndex = 1; playerIndex < 5; playerIndex += 1) {
    allPlayers.push({
      ...buildPlayer(getBotName(allPlayers.map((player) => player.name))),
      type: "ai" as const,
    });
  }

  const playerTokens = allPlayers.map((player) => buildPlayerToken(player.id));
  const hostPlayerToken = playerTokens[0];
  const game: Game = {
    id: generateGameId(),
    version: 1,
    phase: { stage: "Lobby" },
    ownerToken: hostPlayerToken.token,
    options: {
      maxCards: 10,
      blindBid: event.payload.blindBid ?? false,
      aiDifficulty: "medium",
      rounds: [],
    },
    players: allPlayers,
    playerTokens,
    playerOrder: allPlayers.map((player) => player.id),
    scores: allPlayers.map((player) => buildScore(player.id)),
    reactions: [],
  };

  return {
    game,
    playerToken: hostPlayerToken.token,
  };
};
