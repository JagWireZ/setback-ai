import type { LambdaEventPayload } from "@shared/types/lambda";
import type { Game } from "@shared/types/game";
import { generateGameId } from "../helpers/generateGameId";
import { generateRounds } from "../helpers/generateRounds";
import { buildPlayer } from "../helpers/reducer/buildPlayer";
import { buildPlayerToken } from "../helpers/reducer/buildPlayerToken";
import { buildScore } from "../helpers/reducer/buildScore";

type CreateGameResult = {
  game: Game;
  playerToken: string;
};

export const createGame = (event: LambdaEventPayload<"createGame">): CreateGameResult => {
  const hostPlayer = buildPlayer(event.payload.playerName);
  const hostPlayerToken = buildPlayerToken(hostPlayer.id);
  const game: Game = {
    id: generateGameId(),
    version: 1,
    ownerToken: hostPlayerToken.token,
    options: {
      maxCards: event.payload.maxCards,
      blindBid: false,
      rounds: generateRounds(event.payload.maxCards),
    },
    players: [hostPlayer],
    playerTokens: [hostPlayerToken],
    playerOrder: [hostPlayer.id],
    scores: [buildScore(hostPlayer.id)],
  };

  return {
    game,
    playerToken: hostPlayerToken.token,
  };
};
