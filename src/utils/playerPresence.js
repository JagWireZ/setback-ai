export const getPlayerPresence = (player) => ({
  connected: player?.presence?.connected ?? player?.connected ?? false,
  lastSeenAt: player?.presence?.lastSeenAt ?? player?.lastActiveAt,
  away: player?.presence?.away ?? (player?.connected === false),
})

export const getPlayerController = (player) => player?.controller ?? 'human'
