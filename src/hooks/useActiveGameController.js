import {
  coverAwayPlayerTurn,
  dealCards,
  playCard,
  removeGame,
  removePlayer,
  returnFromAway,
  sendReaction,
  sortCards,
  startOver,
  submitBid,
} from '../api/lambdaClient'
import { REACTION_COOLDOWN_MS } from '../utils/gameUi'
import { toGenericErrorMessage } from '../utils/frontendErrors'
import {
  clearTimeoutRef,
  getActiveSessionContext,
  isConcurrentUpdateError,
} from '../utils/sessionState'

export function useActiveGameController({
  ownerSession,
  playerSession,
  currentRoundCardCount,
  sortMode,
  selectedBid,
  isReactionOnCooldown,
  requestActiveStateReview,
  applyRealtimeResult,
  handleRemovedFromGame,
  closeSubmitBidModal,
  setRequestError,
  setSessionInfo,
  setSelectedMaxCards,
  setSelectedAiDifficulty,
  setGameError,
  setLobbyInfo,
  setIsLeavingGame,
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
  setIsPlayingCard,
  setPendingPlayerActionId,
}) {
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
    setGameError('')
    setLobbyInfo('')
    setRequestError('')
    setSessionInfo(null)
    setIsLeavingGame(true)

    try {
      if (ownerSession?.gameId && ownerSession?.playerToken) {
        await removeGame({
          gameId: ownerSession.gameId,
          playerToken: ownerSession.playerToken,
        })
        handleRemovedFromGame(ownerSession.gameId, `You ended game ${ownerSession.gameId}.`)
        return true
      }

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

      await removePlayer({
        gameId: playerSession.gameId,
        playerToken: playerSession.playerToken,
        playerId: leavingPlayerId,
      })
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

  return {
    handleContinueGame,
    handleCoverAwayPlayerTurn,
    handleDealCards,
    handleLeaveGame,
    handlePlayCard,
    handleSendReaction,
    handleSortCards,
    handleStartOver,
    handleSubmitBid,
    openSubmitBidModal,
    toggleSortCards,
  }
}
