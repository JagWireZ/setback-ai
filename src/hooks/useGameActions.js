import {
  addSeat,
  coverAwayPlayerTurn,
  createGame,
  dealCards,
  joinGame,
  movePlayer,
  playCard,
  removePlayer,
  removeSeat,
  renamePlayer,
  returnFromAway,
  sendReaction,
  sortCards,
  startGame,
  startOver,
  submitBid,
} from '../api/lambdaClient'
import {
  clearGameIdInUrl,
  getStoredGameSession,
  normalizeStoredSessionGame,
  saveStoredGameSession,
  setGameIdInUrl,
} from '../utils/gameSessions'
import { REACTION_COOLDOWN_MS } from '../utils/gameUi'
import { toUserFacingActionError } from '../utils/gameUi'
import { validatePlayerName } from '../utils/playerName'
import {
  clearTimeoutRef,
  getActiveSession,
  getActiveSessionRole,
  isConcurrentUpdateError,
} from '../utils/sessionState'

export const useGameActions = ({
  playerName,
  joinGameId,
  selectedRejoinGameId,
  joinPlayerName,
  rejoinableGames,
  ownerSession,
  playerSession,
  selectedMaxCards,
  selectedAiDifficulty,
  orderedPlayers,
  currentRoundCardCount,
  sortMode,
  isReactionOnCooldown,
  activeLobbyPlayerId,
  requestActiveStateReview,
  applyRealtimeResult,
  handleRemovedFromGame,
  closeCreateModal,
  closeJoinModal,
  closeSubmitBidModal,
  setCreateErrors,
  setJoinErrors,
  setRequestError,
  setIsCreatingGame,
  setSessionInfo,
  setOwnerSession,
  setSelectedMaxCards,
  setSelectedAiDifficulty,
  setPlayerSession,
  setGameError,
  setLobbyInfo,
  setIsJoiningGame,
  setIsRejoiningGame,
  setPendingPlayerActionId,
  setIsLeavingGame,
  setIsStartingGame,
  setIsStartingOver,
  setIsDealingCards,
  setSortMode,
  setSelectedBid,
  setIsBidModalOpen,
  setIsSubmittingBid,
  setIsSortingCards,
  setShowAwayContinueModal,
  setIsContinuingGame,
  setIsSendingReaction,
  setReactionCooldownUntil,
  reactionCooldownTimeoutRef,
  setIsRenamingPlayer,
  setIsPlayingCard,
}) => {
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
      setOwnerSession({
        gameId: result?.game?.id,
        playerToken: result?.playerToken,
        game: result?.game,
        ownerPlayerId: result?.game?.players?.find((currentPlayer) => currentPlayer.type === 'human')?.id,
      })
      setSelectedMaxCards(String(result?.game?.options?.maxCards ?? 10))
      setSelectedAiDifficulty(result?.game?.options?.aiDifficulty ?? 'medium')
      setPlayerSession(null)
      setGameError('')
      setLobbyInfo('')
      setGameIdInUrl(result?.game?.id)
      saveStoredGameSession(result?.game?.id, result?.playerToken, 'owner', trimmedPlayerName)
      closeCreateModal()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create game'
      setRequestError(message)
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

      if (restoredSession.role === 'owner') {
        setOwnerSession({
          gameId: selectedGame.gameId,
          playerToken: selectedGame.playerToken,
          game: resumedSession?.game ?? restoredSession.game,
          ownerPlayerId: resumedSession?.ownerPlayerId ?? restoredSession.ownerPlayerId,
        })
        setPlayerSession(null)
        saveStoredGameSession(selectedGame.gameId, selectedGame.playerToken, 'owner', selectedGame.playerName ?? '')
      } else {
        setPlayerSession({
          gameId: selectedGame.gameId,
          playerToken: selectedGame.playerToken,
          game: resumedSession?.game ?? restoredSession.game,
          version: resumedSession?.version ?? restoredSession.version,
        })
        setOwnerSession(null)
        saveStoredGameSession(selectedGame.gameId, selectedGame.playerToken, 'player', selectedGame.playerName ?? '')
      }

      setSessionInfo({
        action: 'rejoinGame',
        gameId: selectedGame.gameId,
      })
      setGameError('')
      setLobbyInfo('')
      setGameIdInUrl(selectedGame.gameId)
      closeJoinModal()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to rejoin game'
      setRequestError(message)
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
      setPlayerSession({
        gameId: result?.game?.id,
        playerToken: result?.playerToken,
        game: result?.game,
        version: result?.version ?? result?.game?.version ?? 0,
      })
      setOwnerSession(null)
      setGameError('')
      setLobbyInfo('')
      setGameIdInUrl(result?.game?.id)
      saveStoredGameSession(result?.game?.id, result?.playerToken, 'player', trimmedPlayerName)
      closeJoinModal()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to join game'
      if (message.toLowerCase().includes('game not found')) {
        setJoinErrors((previousErrors) => ({ ...previousErrors, gameId: 'Game ID does not exist.' }))
        setRequestError('')
      } else {
        setRequestError(message)
      }
    } finally {
      setIsJoiningGame(false)
    }
  }

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
      const message = error instanceof Error ? error.message : 'Unable to move player'
      setGameError(message)
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
      const message = error instanceof Error ? error.message : 'Unable to remove player'
      setGameError(message)
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
      const message = error instanceof Error ? error.message : 'Unable to add seat'
      setGameError(message)
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
      const message = error instanceof Error ? error.message : 'Unable to remove seat'
      setGameError(message)
      return false
    } finally {
      setPendingPlayerActionId('')
    }
  }

  const handleCoverAwayPlayerTurn = async (playerId) => {
    if (!ownerSession?.gameId || !ownerSession?.playerToken) {
      return false
    }

    setGameError('')
    setLobbyInfo('')
    setPendingPlayerActionId(playerId)

    try {
      const result = await coverAwayPlayerTurn({
        gameId: ownerSession.gameId,
        playerToken: ownerSession.playerToken,
        playerId,
      })
      applyRealtimeResult(result, 'owner')
      return true
    } catch (error) {
      if (isConcurrentUpdateError(error)) {
        void requestActiveStateReview()
        return false
      }

      const message = toUserFacingActionError(error, 'Unable to play for away player')
      setGameError(message)
      return false
    } finally {
      setPendingPlayerActionId('')
    }
  }

  const handleLeaveGame = async () => {
    if (!playerSession?.gameId || !playerSession?.playerToken) {
      return false
    }

    const leavingPlayerId =
      playerSession.game?.phase && 'cards' in playerSession.game.phase
        ? playerSession.game.phase.cards.hands?.[0]?.playerId
        : ''

    if (!leavingPlayerId) {
      setGameError('Unable to determine which player should leave this game')
      return false
    }

    setGameError('')
    setLobbyInfo('')
    setRequestError('')
    setSessionInfo(null)
    setIsLeavingGame(true)

    try {
      await removePlayer({
        gameId: playerSession.gameId,
        playerToken: playerSession.playerToken,
        playerId: leavingPlayerId,
      })
      clearGameIdInUrl()
      setSessionInfo(null)
      handleRemovedFromGame(playerSession.gameId, `You left game ${playerSession.gameId}.`)
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to leave game'
      setGameError(message)
      return false
    } finally {
      setIsLeavingGame(false)
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
        dealerPlayerId: orderedPlayers[0]?.id || undefined,
        aiDifficulty: selectedAiDifficulty,
      })
      applyRealtimeResult(result, 'owner')
      setLobbyInfo('Game started.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start game'
      setGameError(message)
    } finally {
      setIsStartingGame(false)
    }
  }

  const handleStartOver = async () => {
    if (!ownerSession?.gameId || !ownerSession?.playerToken) {
      return
    }

    setGameError('')
    setLobbyInfo('')
    setIsStartingOver(true)

    try {
      const result = await startOver({
        gameId: ownerSession.gameId,
        playerToken: ownerSession.playerToken,
      })

      applyRealtimeResult(result, 'owner')
      setSelectedMaxCards(String(result?.game?.options?.maxCards ?? 10))
      setSelectedAiDifficulty(result?.game?.options?.aiDifficulty ?? 'medium')
      setLobbyInfo('Game reset to lobby.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start over'
      setGameError(message)
    } finally {
      setIsStartingOver(false)
    }
  }

  const handleDealCards = async () => {
    const activeSession = getActiveSession({ ownerSession, playerSession })
    const activeRole = getActiveSessionRole({ ownerSession, playerSession })
    if (!activeSession?.gameId || !activeSession?.playerToken) {
      return
    }

    setGameError('')
    setLobbyInfo('')
    setIsDealingCards(true)

    try {
      const result = await dealCards({
        gameId: activeSession.gameId,
        playerToken: activeSession.playerToken,
      })

      applyRealtimeResult(result, activeRole ?? 'player')
      setSortMode('byRank')
    } catch (error) {
      if (isConcurrentUpdateError(error)) {
        void requestActiveStateReview()
        return
      }

      const message = toUserFacingActionError(error, 'Unable to deal cards')
      setGameError(message)
    } finally {
      setIsDealingCards(false)
    }
  }

  const openSubmitBidModal = () => {
    setSelectedBid('0')
    setIsBidModalOpen(true)
  }

  const handleSubmitBid = async (event) => {
    event.preventDefault()

    const activeSession = getActiveSession({ ownerSession, playerSession })
    const activeRole = getActiveSessionRole({ ownerSession, playerSession })
    if (!activeSession?.gameId || !activeSession?.playerToken) {
      return
    }

    setGameError('')
    setLobbyInfo('')
    setIsSubmittingBid(true)

    try {
      const isTripBid = selectedBid === 'trip'
      const result = await submitBid({
        gameId: activeSession.gameId,
        playerToken: activeSession.playerToken,
        bid: isTripBid ? currentRoundCardCount : Number(selectedBid),
        ...(isTripBid ? { trip: true } : {}),
      })

      applyRealtimeResult(result, activeRole ?? 'player')
      closeSubmitBidModal()
    } catch (error) {
      if (isConcurrentUpdateError(error)) {
        void requestActiveStateReview()
        return
      }

      const message = toUserFacingActionError(error, 'Unable to submit bid')
      setGameError(message)
    } finally {
      setIsSubmittingBid(false)
    }
  }

  const handleSortCards = async (mode) => {
    const activeSession = getActiveSession({ ownerSession, playerSession })
    const activeRole = getActiveSessionRole({ ownerSession, playerSession })
    const activeGame = activeSession?.game
    if (!activeSession?.gameId || !activeSession?.playerToken || activeGame?.phase?.stage === 'Dealing') {
      return
    }

    setGameError('')
    setLobbyInfo('')
    setIsSortingCards(true)

    try {
      const result = await sortCards({
        gameId: activeSession.gameId,
        playerToken: activeSession.playerToken,
        mode,
      })

      applyRealtimeResult(result, activeRole ?? 'player')
      setSortMode(mode)
    } catch (error) {
      if (isConcurrentUpdateError(error)) {
        void requestActiveStateReview()
        return
      }

      const message = toUserFacingActionError(error, 'Unable to sort cards')
      setGameError(message)
    } finally {
      setIsSortingCards(false)
    }
  }

  const toggleSortCards = () => {
    void handleSortCards(sortMode === 'bySuit' ? 'byRank' : 'bySuit')
  }

  const handleContinueGame = async () => {
    const activeSession = getActiveSession({ ownerSession, playerSession })
    const activeRole = getActiveSessionRole({ ownerSession, playerSession })
    if (!activeSession?.gameId || !activeSession?.playerToken) {
      return
    }

    setGameError('')
    setIsContinuingGame(true)

    try {
      const result = await returnFromAway({
        gameId: activeSession.gameId,
        playerToken: activeSession.playerToken,
      })
      setShowAwayContinueModal(false)

      applyRealtimeResult(result, activeRole ?? 'player')
    } finally {
      setIsContinuingGame(false)
    }
  }

  const handleSendReaction = async (reactionInput) => {
    const activeSession = getActiveSession({ ownerSession, playerSession })
    const activeRole = getActiveSessionRole({ ownerSession, playerSession })
    if (!activeSession?.gameId || !activeSession?.playerToken || isReactionOnCooldown) {
      return
    }

    const reactionPayload =
      typeof reactionInput === 'string'
        ? { emoji: reactionInput }
        : reactionInput?.emoji
          ? { emoji: reactionInput.emoji }
          : reactionInput?.phrase
            ? { phrase: reactionInput.phrase }
            : null

    if (!reactionPayload) {
      return
    }

    setGameError('')
    setIsSendingReaction(true)

    try {
      const result = await sendReaction({
        gameId: activeSession.gameId,
        playerToken: activeSession.playerToken,
        ...reactionPayload,
      })

      applyRealtimeResult(result, activeRole ?? 'player')
      const nextCooldownUntil = Date.now() + REACTION_COOLDOWN_MS
      setReactionCooldownUntil(nextCooldownUntil)
      clearTimeoutRef(reactionCooldownTimeoutRef)
      reactionCooldownTimeoutRef.current = setTimeout(() => {
        setReactionCooldownUntil(0)
        reactionCooldownTimeoutRef.current = null
      }, REACTION_COOLDOWN_MS)
    } catch (error) {
      if (isConcurrentUpdateError(error)) {
        void requestActiveStateReview()
        return
      }

      const message = toUserFacingActionError(error, 'Unable to send reaction')
      setGameError(message)
      throw error
    } finally {
      setIsSendingReaction(false)
    }
  }

  const handleRenamePlayer = async (nextPlayerName, playerId) => {
    const activeSession = getActiveSession({ ownerSession, playerSession })
    const activeRole = getActiveSessionRole({ ownerSession, playerSession })
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
      const message = error instanceof Error ? error.message : 'Unable to update player name'
      setGameError(message)
      return false
    } finally {
      setIsRenamingPlayer(false)
    }
  }

  const handlePlayCard = async (card) => {
    const activeSession = getActiveSession({ ownerSession, playerSession })
    const activeRole = getActiveSessionRole({ ownerSession, playerSession })
    const activeGame = activeSession?.game
    if (!activeSession?.gameId || !activeSession?.playerToken || !activeGame) {
      return
    }

    setGameError('')
    setLobbyInfo('')
    setIsPlayingCard(true)

    try {
      const result = await playCard({
        gameId: activeSession.gameId,
        playerToken: activeSession.playerToken,
        card,
      })

      applyRealtimeResult(result, activeRole ?? 'player')
    } catch (error) {
      if (isConcurrentUpdateError(error)) {
        void requestActiveStateReview()
        return
      }

      const message = toUserFacingActionError(error, 'Unable to play card')
      setGameError(message)
    } finally {
      setIsPlayingCard(false)
    }
  }

  return {
    handleAddSeat,
    handleContinueGame,
    handleCoverAwayPlayerTurn,
    handleCreateGame,
    handleDealCards,
    handleJoinGame,
    handleLeaveGame,
    handleMovePlayer,
    handlePlayCard,
    handleRejoinGame,
    handleRemovePlayer,
    handleRemoveSeat,
    handleRenamePlayer,
    handleSendReaction,
    handleSortCards,
    handleStartGame,
    handleStartOver,
    handleSubmitBid,
    openSubmitBidModal,
    toggleSortCards,
  }
}
