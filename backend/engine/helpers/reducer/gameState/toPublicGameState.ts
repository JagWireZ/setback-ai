import type { Game } from "@shared/types/game";

export const toPublicGameState = (
  game: Game,
  viewerPlayerToken?: string,
): Omit<Game, "playerTokens" | "ownerToken"> => {
  const viewerPlayerId = viewerPlayerToken
    ? game.playerTokens.find((entry) => entry.token === viewerPlayerToken)?.playerId
    : undefined;

  const publicPhase = "cards" in game.phase
    ? {
        ...game.phase,
        cards: {
          ...game.phase.cards,
          deck: [],
          hands: game.phase.cards.hands.map((hand) => ({
            ...hand,
            cards: hand.playerId === viewerPlayerId ? hand.cards : [],
          })),
        },
      }
    : game.phase;

  const { playerTokens: _playerTokens, ownerToken: _ownerToken, ...publicGame } = game;
  return {
    ...publicGame,
    phase: publicPhase,
  };
};
