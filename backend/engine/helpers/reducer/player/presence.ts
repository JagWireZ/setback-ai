import type { Game, Player, PlayerController, PlayerPresence } from "@shared/types/game";
import { withNextVersion } from "../gameState/withNextVersion";

export const getPlayerPresence = (player: Player): PlayerPresence => ({
  connected: player.presence?.connected ?? player.connected ?? false,
  lastSeenAt: player.presence?.lastSeenAt ?? player.lastActiveAt,
  away: player.presence?.away ?? (player.connected === false),
});

export const getPlayerController = (player: Player): PlayerController =>
  player.controller ?? "human";

export const mapPlayerState = (
  game: Game,
  playerId: string,
  mapper: (player: Player) => Player,
): Game => {
  let didChange = false;
  const players = game.players.map((player) => {
    if (player.id !== playerId) {
      return player;
    }

    const nextPlayer = mapper(player);
    didChange ||= nextPlayer !== player;
    return nextPlayer;
  });

  if (!didChange) {
    return game;
  }

  return {
    ...game,
    players,
  };
};

export const setPlayerPresence = (
  game: Game,
  playerId: string,
  patch: Partial<PlayerPresence>,
): Game => {
  const mapped = mapPlayerState(game, playerId, (player) => {
    const currentPresence = getPlayerPresence(player);
    const nextPresence = {
      ...currentPresence,
      ...patch,
    };

    const changed =
      currentPresence.connected !== nextPresence.connected ||
      currentPresence.lastSeenAt !== nextPresence.lastSeenAt ||
      currentPresence.away !== nextPresence.away;
    if (!changed) {
      return player;
    }

    return {
      ...player,
      presence: nextPresence,
    };
  });

  return mapped === game ? game : withNextVersion(game, { players: mapped.players });
};

export const touchPlayerPresence = (
  game: Game,
  playerId: string,
  options: { connected?: boolean; lastSeenAt?: number } = {},
): Game => {
  const lastSeenAt = options.lastSeenAt ?? Date.now();
  return setPlayerPresence(game, playerId, {
    ...(typeof options.connected === "boolean" ? { connected: options.connected } : {}),
    lastSeenAt,
  });
};

export const setPlayerController = (
  game: Game,
  playerId: string,
  controller: PlayerController,
): Game =>
  mapPlayerState(game, playerId, (player) =>
    getPlayerController(player) === controller
      ? player
      : {
          ...player,
          controller,
        },
  );
