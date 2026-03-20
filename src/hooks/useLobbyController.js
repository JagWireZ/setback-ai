import {
  addSeat,
  movePlayer,
  removePlayer,
  removeSeat,
  startGame,
} from '../api/lambdaClient'
import { toGenericErrorMessage } from '../utils/frontendErrors'
import { useLobbyDerivedState } from './useLobbyDerivedState'

export const AI_DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
]

export const MAX_SEATS = 8

export function useLobbyController({
  ownerSession,
  playerSession,
  selectedMaxCards,
  selectedAiDifficulty,
  setPendingPlayerActionId,
  setGameError,
  setLobbyInfo,
  setIsStartingGame,
  applyRealtimeResult,
}) {
  const lobby = useLobbyDerivedState({
    ownerSession,
    playerSession,
  })

  const currentDealerPlayerId =
    ownerSession?.game?.phase?.dealerPlayerId ?? lobby.orderedPlayers[0]?.id ?? ''

  const handleMovePlayer = async (playerId, direction) => {
    if (!ownerSession?.gameId || !ownerSession?.playerToken) {
      return
    }

    setGameError('')
    setLobbyInfo('')
    setPendingPlayerActionId(playerId)

    try {
      const result = await movePlayer({
        gameId: ownerSession.gameId,
        playerToken: ownerSession.playerToken,
        playerId,
        direction,
      })
      applyRealtimeResult(result, 'owner')
    } catch (error) {
      setGameError(toGenericErrorMessage(error, 'Unable to move player.'))
    } finally {
      setPendingPlayerActionId('')
    }
  }

  const handleRemovePlayer = async (playerId) => {
    if (!ownerSession?.gameId || !ownerSession?.playerToken) {
      return false
    }

    setGameError('')
    setLobbyInfo('')
    setPendingPlayerActionId(playerId)

    try {
      const result = await removePlayer({
        gameId: ownerSession.gameId,
        playerToken: ownerSession.playerToken,
        playerId,
      })
      applyRealtimeResult(result, 'owner')
      return true
    } catch (error) {
      setGameError(toGenericErrorMessage(error, 'Unable to remove player.'))
      return false
    } finally {
      setPendingPlayerActionId('')
    }
  }

  const handleAddSeat = async () => {
    if (!ownerSession?.gameId || !ownerSession?.playerToken) {
      return false
    }

    setGameError('')
    setLobbyInfo('')
    setPendingPlayerActionId('add-seat')

    try {
      const result = await addSeat({
        gameId: ownerSession.gameId,
        playerToken: ownerSession.playerToken,
      })
      applyRealtimeResult(result, 'owner')
      setLobbyInfo('Seat added.')
      return true
    } catch (error) {
      setGameError(toGenericErrorMessage(error, 'Unable to add seat.'))
      return false
    } finally {
      setPendingPlayerActionId('')
    }
  }

  const handleRemoveSeat = async (playerId) => {
    if (!ownerSession?.gameId || !ownerSession?.playerToken) {
      return false
    }

    setGameError('')
    setLobbyInfo('')
    setPendingPlayerActionId(playerId)

    try {
      const result = await removeSeat({
        gameId: ownerSession.gameId,
        playerToken: ownerSession.playerToken,
        playerId,
      })
      applyRealtimeResult(result, 'owner')
      setLobbyInfo('Seat removed.')
      return true
    } catch (error) {
      setGameError(toGenericErrorMessage(error, 'Unable to remove seat.'))
      return false
    } finally {
      setPendingPlayerActionId('')
    }
  }

  const handleStartGame = async () => {
    if (!ownerSession?.gameId || !ownerSession?.playerToken) {
      return
    }

    setGameError('')
    setLobbyInfo('')
    setIsStartingGame(true)

    try {
      const result = await startGame({
        gameId: ownerSession.gameId,
        playerToken: ownerSession.playerToken,
        maxCards: Number(selectedMaxCards),
        dealerPlayerId: lobby.orderedPlayers[0]?.id || undefined,
        aiDifficulty: selectedAiDifficulty,
      })
      applyRealtimeResult(result, 'owner')
      setLobbyInfo('Game started.')
    } catch (error) {
      setGameError(toGenericErrorMessage(error, 'Unable to start game.'))
    } finally {
      setIsStartingGame(false)
    }
  }

  return {
    ...lobby,
    currentDealerPlayerId,
    handleAddSeat,
    handleMovePlayer,
    handleRemovePlayer,
    handleRemoveSeat,
    handleStartGame,
    aiDifficultyOptions: AI_DIFFICULTY_OPTIONS,
    maxSeats: MAX_SEATS,
  }
}
