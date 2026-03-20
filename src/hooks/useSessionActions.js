import {
  createGame,
  joinGame,
  renamePlayer,
  returnFromAway,
} from '../api/lambdaClient'
import {
  getStoredGameSession,
  normalizeStoredSessionGame,
  saveStoredGameSession,
  setGameIdInUrl,
} from '../utils/gameSessions'
import { toGenericErrorMessage } from '../utils/frontendErrors'
import { validatePlayerName } from '../utils/playerName'
import {
  buildOwnerSession,
  buildPlayerSession,
  getActiveSessionContext,
  setSessionForRole,
} from '../utils/sessionState'

export function useSessionActions({
  appState,
  appActions,
  activeLobbyPlayerId,
  closeCreateModal,
  closeJoinModal,
  applyRealtimeResult,
}) {
  const {
    joinGameId,
    joinPlayerName,
    ownerSession,
    playerName,
    playerSession,
    rejoinableGames,
    selectedRejoinGameId,
  } = appState
  const {
    setCreateErrors,
    setGameError,
    setIsCreatingGame,
    setIsJoiningGame,
    setIsRejoiningGame,
    setIsRenamingPlayer,
    setJoinErrors,
    setLobbyInfo,
    setOwnerSession,
    setPlayerSession,
    setRequestError,
    setSelectedAiDifficulty,
    setSelectedMaxCards,
    setSessionInfo,
  } = appActions

  const handleCreateGame = async (event) => {
    event.preventDefault()
    const errors = {}
    const trimmedPlayerName = playerName.trim()
    const playerNameError = validatePlayerName(playerName)

    if (playerNameError) {
      errors.playerName = playerNameError
    }

    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors)
      return
    }

    setCreateErrors({})
    setRequestError('')
    setIsCreatingGame(true)

    try {
      const result = await createGame({
        playerName: trimmedPlayerName,
      })
      setSessionInfo({
        action: 'createGame',
        gameId: result?.game?.id,
        playerToken: result?.playerToken,
      })
      setSessionForRole({
        role: 'owner',
        session: buildOwnerSession({
          gameId: result?.game?.id,
          playerToken: result?.playerToken,
          game: result?.game,
          ownerPlayerId: result?.game?.players?.find((currentPlayer) => currentPlayer.type === 'human')?.id,
        }),
        setOwnerSession,
        setPlayerSession,
      })
      setSelectedMaxCards(String(result?.game?.options?.maxCards ?? 10))
      setSelectedAiDifficulty(result?.game?.options?.aiDifficulty ?? 'medium')
      setGameError('')
      setLobbyInfo('')
      setGameIdInUrl(result?.game?.id)
      saveStoredGameSession(result?.game?.id, result?.playerToken, 'owner', trimmedPlayerName)
      closeCreateModal()
    } catch (error) {
      setRequestError(toGenericErrorMessage(error, 'Unable to create game.'))
    } finally {
      setIsCreatingGame(false)
    }
  }

  const handleRejoinGame = async (event) => {
    event.preventDefault()

    const selectedGame = rejoinableGames.find((game) => game.gameId === selectedRejoinGameId)
    if (!selectedGame?.gameId || !selectedGame.playerToken) {
      return
    }

    setRequestError('')
    setIsRejoiningGame(true)

    try {
      const restoredSession = await normalizeStoredSessionGame(
        selectedGame.gameId,
        selectedGame.playerToken,
        selectedGame.role,
      )

      if (!restoredSession?.game || restoredSession.game.phase?.stage === 'GameOver') {
        throw new Error('Stored game is no longer available to rejoin')
      }

      const resumedSession = await returnFromAway({
        gameId: selectedGame.gameId,
        playerToken: selectedGame.playerToken,
      })

      const role = restoredSession.role === 'owner' ? 'owner' : 'player'
      const session = role === 'owner'
        ? buildOwnerSession({
            gameId: selectedGame.gameId,
            playerToken: selectedGame.playerToken,
            game: resumedSession?.game ?? restoredSession.game,
            ownerPlayerId: resumedSession?.ownerPlayerId ?? restoredSession.ownerPlayerId,
          })
        : buildPlayerSession({
            gameId: selectedGame.gameId,
            playerToken: selectedGame.playerToken,
            game: resumedSession?.game ?? restoredSession.game,
            version: resumedSession?.version ?? restoredSession.version,
          })

      setSessionForRole({
        role,
        session,
        setOwnerSession,
        setPlayerSession,
      })
      saveStoredGameSession(selectedGame.gameId, selectedGame.playerToken, role, selectedGame.playerName ?? '')

      setSessionInfo({
        action: 'rejoinGame',
        gameId: selectedGame.gameId,
      })
      setGameError('')
      setLobbyInfo('')
      setGameIdInUrl(selectedGame.gameId)
      closeJoinModal()
    } catch (error) {
      setRequestError(toGenericErrorMessage(error, 'Unable to rejoin game.'))
    } finally {
      setIsRejoiningGame(false)
    }
  }

  const handleJoinGame = async (event) => {
    event.preventDefault()

    if (selectedRejoinGameId) {
      await handleRejoinGame(event)
      return
    }

    const errors = {}
    const trimmedPlayerName = joinPlayerName.trim()
    const playerNameError = validatePlayerName(joinPlayerName)

    if (!joinGameId.trim()) {
      errors.gameId = 'Game ID is required.'
    }

    if (playerNameError) {
      errors.playerName = playerNameError
    }

    if (Object.keys(errors).length > 0) {
      setJoinErrors(errors)
      return
    }

    setJoinErrors({})
    setRequestError('')
    setIsJoiningGame(true)

    try {
      const result = await joinGame({
        gameId: joinGameId.trim(),
        playerName: trimmedPlayerName,
      })
      setSessionInfo({
        action: 'joinGame',
        gameId: result?.game?.id,
        playerToken: result?.playerToken,
      })
      setSessionForRole({
        role: 'player',
        session: buildPlayerSession({
          gameId: result?.game?.id,
          playerToken: result?.playerToken,
          game: result?.game,
          version: result?.version ?? result?.game?.version ?? 0,
        }),
        setOwnerSession,
        setPlayerSession,
      })
      setGameError('')
      setLobbyInfo('')
      setGameIdInUrl(result?.game?.id)
      saveStoredGameSession(result?.game?.id, result?.playerToken, 'player', trimmedPlayerName)
      closeJoinModal()
    } catch (error) {
      setRequestError(toGenericErrorMessage(error, 'Unable to join game.'))
    } finally {
      setIsJoiningGame(false)
    }
  }

  const handleRenamePlayer = async (nextPlayerName, playerId) => {
    const { role: activeRole, session: activeSession } = getActiveSessionContext({ ownerSession, playerSession })
    if (!activeSession?.gameId || !activeSession?.playerToken) {
      return false
    }

    setGameError('')
    setLobbyInfo('')
    setIsRenamingPlayer(true)

    try {
      const result = await renamePlayer({
        gameId: activeSession.gameId,
        playerToken: activeSession.playerToken,
        playerName: nextPlayerName,
        playerId,
      })

      applyRealtimeResult(result, activeRole ?? 'player')

      if (activeSession.gameId) {
        const storedSession = getStoredGameSession(activeSession.gameId)
        const renamedPlayerId = playerId ?? activeLobbyPlayerId
        const shouldUpdateStoredName =
          storedSession?.playerToken === activeSession.playerToken &&
          renamedPlayerId &&
          renamedPlayerId === activeLobbyPlayerId

        if (shouldUpdateStoredName) {
          saveStoredGameSession(
            activeSession.gameId,
            activeSession.playerToken,
            activeRole ?? 'player',
            nextPlayerName.trim(),
          )
        }
      }

      return true
    } catch (error) {
      setGameError(toGenericErrorMessage(error, 'Unable to update player name.'))
      return false
    } finally {
      setIsRenamingPlayer(false)
    }
  }

  return {
    handleCreateGame,
    handleJoinGame,
    handleRenamePlayer,
  }
}
