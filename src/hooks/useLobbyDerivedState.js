import { useMemo } from 'react'
import {
  getCompletedRoundCount,
  getMaxCardsForSeatCount,
  getViewerHand,
} from '../utils/gameUi'
import { getStoredGameSession } from '../utils/gameSessions'
import { getPlayerPresence } from '../utils/playerPresence'

export const useLobbyDerivedState = ({
  ownerSession,
  playerSession,
}) => {
  const activeLobbySession = ownerSession ?? playerSession
  const isOwnerLobby = Boolean(ownerSession)
  const activeGame = activeLobbySession?.game
  const activeRoundIndex =
    activeGame?.phase && 'roundIndex' in activeGame.phase ? activeGame.phase.roundIndex : 0
  const currentRoundCardCount = activeGame?.options?.rounds?.[activeRoundIndex]?.cardCount ?? 0
  const isTripRound = [1, 2, 3].includes(currentRoundCardCount)
  const completedRoundCount = getCompletedRoundCount(activeGame)

  const orderedPlayers = useMemo(() => {
    const game = activeLobbySession?.game
    if (!game) {
      return []
    }

    const playersById = new Map((game.players ?? []).map((player) => [player.id, player]))
    return (game.playerOrder ?? [])
      .map((playerId) => playersById.get(playerId))
      .filter(Boolean)
  }, [activeLobbySession?.game])

  const maxCardsForLobbySeatCount = useMemo(
    () => getMaxCardsForSeatCount(orderedPlayers.length || 1),
    [orderedPlayers.length],
  )

  const activeLobbyPlayerId = useMemo(() => {
    if (!activeLobbySession?.game) {
      return ''
    }

    if (ownerSession?.ownerPlayerId) {
      return ownerSession.ownerPlayerId
    }

    const viewerPlayerId = getViewerHand(activeLobbySession.game)?.playerId
    if (viewerPlayerId) {
      return viewerPlayerId
    }

    const storedPlayerName = getStoredGameSession(activeLobbySession.gameId)?.playerName?.trim()
    if (!storedPlayerName) {
      return ''
    }

    return activeLobbySession.game.players?.find((player) => player.name === storedPlayerName)?.id ?? ''
  }, [activeLobbySession?.game, activeLobbySession?.gameId, ownerSession?.ownerPlayerId])

  const activeLobbyPlayer =
    activeLobbyPlayerId && activeLobbySession?.game
      ? activeLobbySession.game.players?.find((player) => player.id === activeLobbyPlayerId) ?? null
      : null

  const isLocalPlayerMarkedAway =
    !ownerSession &&
    activeLobbyPlayer?.type === 'human' &&
    getPlayerPresence(activeLobbyPlayer).away

  const activeSessionKey = ownerSession
    ? `owner:${ownerSession.gameId}:${ownerSession.playerToken}`
    : playerSession
      ? `player:${playerSession.gameId}:${playerSession.playerToken}`
      : ''

  const shareLink = useMemo(() => {
    if (!activeLobbySession?.gameId || typeof window === 'undefined') {
      return ''
    }

    const url = new URL(window.location.href)
    url.searchParams.set('gameid', activeLobbySession.gameId)
    url.searchParams.delete('gameId')
    return url.toString()
  }, [activeLobbySession?.gameId])

  return {
    activeGame,
    activeLobbyPlayer,
    activeLobbyPlayerId,
    activeLobbySession,
    activeRoundIndex,
    activeSessionKey,
    completedRoundCount,
    currentRoundCardCount,
    isLocalPlayerMarkedAway,
    isOwnerLobby,
    isTripRound,
    maxCardsForLobbySeatCount,
    orderedPlayers,
    shareLink,
  }
}
