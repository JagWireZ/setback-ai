import type { Card, Game } from "@shared/types/game";
import type { LambdaEventPayload } from "@shared/types/lambda";
import { getGameById } from "../helpers/reducer/storage/getGameById";
import { putGame } from "../helpers/reducer/storage/putGame";
import { dealCards } from "../reducer/dealCards";
import { playCard } from "../reducer/playCard";
import { submitBid } from "../reducer/submitBid";

const MAX_AI_STEPS = 200;

const getPlayerTokenById = (game: Game, playerId: string): string => {
  const tokenEntry = game.playerTokens.find((entry) => entry.playerId === playerId);
  if (!tokenEntry) {
    throw new Error("Missing player token for AI player");
  }

  return tokenEntry.token;
};

const getAiTurnPlayer = (game: Game): { playerId: string; token: string } | undefined => {
  if (!("turnPlayerId" in game.phase)) {
    return undefined;
  }

  const turnPlayerId = game.phase.turnPlayerId;
  const turnPlayer = game.players.find((player) => player.id === turnPlayerId);
  if (!turnPlayer || turnPlayer.type !== "ai") {
    return undefined;
  }

  return {
    playerId: turnPlayerId,
    token: getPlayerTokenById(game, turnPlayerId),
  };
};

const chooseAiBid = (game: Game): { bid: number; trip?: boolean } => {
  if (game.phase.stage !== "Bidding") {
    throw new Error("AI bid requested outside Bidding phase");
  }

  const round = game.options.rounds[game.phase.roundIndex];
  if (!round) {
    throw new Error("Round not found for current phase");
  }

  return { bid: 0 };
};

const chooseAiPlayableCard = (game: Game, aiPlayerId: string, token: string): Card => {
  if (game.phase.stage !== "Playing") {
    throw new Error("AI play requested outside Playing phase");
  }

  const aiHand = game.phase.cards.hands.find((hand) => hand.playerId === aiPlayerId);
  if (!aiHand) {
    throw new Error("AI hand not found");
  }

  let lastError: Error | undefined;
  for (const card of aiHand.cards) {
    const candidateEvent: LambdaEventPayload<"playCard"> = {
      action: "playCard",
      payload: {
        gameId: game.id,
        playerToken: token,
        card,
      },
    };

    try {
      playCard(game, candidateEvent);
      return card;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown AI play error");
    }
  }

  throw lastError ?? new Error("AI has no playable card");
};

const applyAiAction = (game: Game): Game | undefined => {
  const aiTurn = getAiTurnPlayer(game);
  if (!aiTurn) {
    return undefined;
  }

  if (game.phase.stage === "Dealing") {
    const event: LambdaEventPayload<"dealCards"> = {
      action: "dealCards",
      payload: {
        gameId: game.id,
        playerToken: aiTurn.token,
      },
    };
    return dealCards(game, event);
  }

  if (game.phase.stage === "Bidding") {
    const aiBid = chooseAiBid(game);
    const event: LambdaEventPayload<"submitBid"> = {
      action: "submitBid",
      payload: {
        gameId: game.id,
        playerToken: aiTurn.token,
        bid: aiBid.bid,
        ...(typeof aiBid.trip === "boolean" ? { trip: aiBid.trip } : {}),
      },
    };
    return submitBid(game, event);
  }

  if (game.phase.stage === "Playing") {
    const card = chooseAiPlayableCard(game, aiTurn.playerId, aiTurn.token);
    const event: LambdaEventPayload<"playCard"> = {
      action: "playCard",
      payload: {
        gameId: game.id,
        playerToken: aiTurn.token,
        card,
      },
    };
    return playCard(game, event);
  }

  return undefined;
};

export const runAiTurnsForGame = async (gameId: string): Promise<Game | undefined> => {
  let game = await getGameById(gameId);
  if (!game) {
    return undefined;
  }

  for (let step = 0; step < MAX_AI_STEPS; step += 1) {
    const updatedGame = applyAiAction(game);
    if (!updatedGame) {
      return game;
    }

    await putGame(updatedGame);
    game = updatedGame;
  }

  throw new Error("AI turn resolution exceeded step limit");
};
