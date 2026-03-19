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
import { toGenericErrorMessage } from '../utils/frontendErrors'
import { validatePlayerName } from '../utils/playerName'
import {
  buildOwnerSession,
  buildPlayerSession,
  clearTimeoutRef,
  getActiveSession,
  getActiveSessionContext,
  getActiveSessionRole,
  isConcurrentUpdateError,
  setSessionForRole,
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
  selectedBid,
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

      setGameError(toGenericErrorMessage(error, 'Unable to play for away player.'))
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
      setGameError(toGenericErrorMessage(error, 'Unable to leave game.'))
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
      setGameError(toGenericErrorMessage(error, 'Unable to start game.'))
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
      setGameError(toGenericErrorMessage(error, 'Unable to start over.'))
    } finally {
      setIsStartingOver(false)
    }
  }

  const handleDealCards = async () => {
    const { role: activeRole, session: activeSession } = getActiveSessionContext({ ownerSession, playerSession })
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

      setGameError(toGenericErrorMessage(error, 'Unable to deal cards.'))
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

    const { role: activeRole, session: activeSession } = getActiveSessionContext({ ownerSession, playerSession })
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

      setGameError(toGenericErrorMessage(error, 'Unable to submit bid.'))
    } finally {
      setIsSubmittingBid(false)
    }
  }

  const handleSortCards = async (mode) => {
    const { role: activeRole, session: activeSession } = getActiveSessionContext({ ownerSession, playerSession })
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

      setGameError(toGenericErrorMessage(error, 'Unable to sort cards.'))
    } finally {
      setIsSortingCards(false)
    }
  }

  const toggleSortCards = () => {
    void handleSortCards(sortMode === 'bySuit' ? 'byRank' : 'bySuit')
  }

  const handleContinueGame = async () => {
    const { role: activeRole, session: activeSession } = getActiveSessionContext({ ownerSession, playerSession })
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
    const { role: activeRole, session: activeSession } = getActiveSessionContext({ ownerSession, playerSession })
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

      setGameError(toGenericErrorMessage(error, 'Unable to send reaction.'))
      throw error
    } finally {
      setIsSendingReaction(false)
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

  const handlePlayCard = async (card) => {
    const { role: activeRole, session: activeSession } = getActiveSessionContext({ ownerSession, playerSession })
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

      setGameError(toGenericErrorMessage(error, 'Unable to play card.'))
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
