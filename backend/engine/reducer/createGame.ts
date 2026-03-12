import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Game } from "@shared/types/game";
import { generateGameId } from "../helpers/generateGameId";
import { generateRounds } from "../helpers/generateRounds";
import { buildPlayer } from "../helpers/reducer/player/buildPlayer";
import { buildPlayerToken } from "../helpers/reducer/player/buildPlayerToken";
import { buildScore } from "../helpers/reducer/player/buildScore";

type CreateGameResult = {
  game: Game;
  playerToken: string;
};

export const createGame = (event: LambdaEventPayload<"createGame">): CreateGameResult => {
  const players = Array.from({ length: 5 }, (_, index) => {
    const playerName = index === 0 ? event.payload.playerName : `AI ${index + 1}`;
    return {
      ...buildPlayer(playerName),
      type: "ai" as const,
    };
  });
  const hostPlayer = {
    ...players[0],
    type: "human" as const,
  };
  const allPlayers = [hostPlayer, ...players.slice(1)];
  const playerTokens = allPlayers.map((player) => buildPlayerToken(player.id));
  const hostPlayerToken = playerTokens[0];
  const game: Game = {
    id: generateGameId(),
    version: 1,
    phase: { stage: "Lobby" },
    ownerToken: hostPlayerToken.token,
    options: {
      maxCards: event.payload.maxCards,
      blindBid: event.payload.blindBid ?? false,
      rounds: generateRounds(event.payload.maxCards),
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
