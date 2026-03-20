import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import {
  checkState,
  getGameState,
  returnFromAway,
  setActiveGameSession,
  subscribeToGameEvents,
} from '../api/lambdaClient'
import { logFrontendError, toGenericErrorMessage } from '../utils/frontendErrors'
import {
  TRICK_COMPLETE_DELAY_MS,
  buildRoundSummary,
  getViewerHand,
} from '../utils/gameUi'
import {
  clearGameIdInUrl,
  clearStoredGameSession,
  getGameIdFromUrl,
  getStoredGameSession,
  normalizeStoredSessionGame,
  pruneMissingStoredGameSessions,
  saveStoredGameSession,
} from '../utils/gameSessions'
import {
  applyResultToSessionRole,
  buildOwnerSession,
  buildPlayerSession,
  clearActiveSessionState as clearSessionState,
  clearTimeoutRefs,
  getActiveSessionContext,
  getActiveSessionRole,
  getRestoredPlayerName,
} from '../utils/sessionState'

export const useAppRuntime = ({
  appState,
  appActions,
  activeGame,
  activeLobbySession,
  activeSessionKey,
  completedRoundCount,
  isLocalPlayerMarkedAway,
  isOwnerLobby,
  maxCardsForLobbySeatCount,
  selectedMaxCards,
  shareLink,
  isLobbyShareModalOpen,
  reactionCooldownUntil,
  setIsEndOfRoundModalDismissed,
  setIsBidModalOpen,
  openJoinModal,
  closeJoinModal,
  setShowAwayContinueModal,
  setShareQrCodeDataUrl,
  setIsShareLinkCopied,
}) => {
  const {
    gameError,
    ownerSession,
    playerSession,
  } = appState
  const {
    rejoinableGamesLoaded,
    rejoinableGamesLoadingStarted,
    sessionRestoreInitialized,
    sessionRestoreSucceeded,
    setGameError,
    setLobbyInfo,
    setOwnerSession,
    setPersistedEndOfRoundSummary,
    setPlayerSession,
    setRequestError,
    setSelectedMaxCards,
    setSessionInfo,
    setSortMode,
  } = appActions

  const aiPauseUntilRef = useRef(0)
  const awayModalSessionKeyRef = useRef('')
  const wasLocalPlayerAwayRef = useRef(false)
  const aiPauseTimeoutRef = useRef(null)
  const previousCompletedTrickCountRef = useRef(0)
  const latestShownRoundIndexRef = useRef(-1)
  const lastDealtSortResetKeyRef = useRef('')
  const hydratedRoundSummaryGameIdRef = useRef('')
  const gameErrorTimeoutRef = useRef(null)
  const shareLinkCopiedTimeoutRef = useRef(null)
  const reactionCooldownTimeoutRef = useRef(null)
  const endOfRoundSummaryTimeoutRef = useRef(null)
  const gameOverScoreTimeoutRef = useRef(null)
  const previousLobbyMaxCardsRef = useRef(null)
  const isReactionOnCooldown = reactionCooldownUntil > Date.now()

  useEffect(() => () => {
    clearTimeoutRefs([
      shareLinkCopiedTimeoutRef,
      reactionCooldownTimeoutRef,
      endOfRoundSummaryTimeoutRef,
      gameOverScoreTimeoutRef,
    ])
  }, [])

  const clearActiveSessionState = () => {
    clearSessionState({
      timeoutRefs: [
        aiPauseTimeoutRef,
        gameErrorTimeoutRef,
        endOfRoundSummaryTimeoutRef,
        gameOverScoreTimeoutRef,
      ],
      trackingRefs: {
        aiPauseUntilRef,
        previousCompletedTrickCountRef,
        latestShownRoundIndexRef,
        hydratedRoundSummaryGameIdRef,
      },
      setOwnerSession,
      setPlayerSession,
      setGameError,
      setLobbyInfo,
      setPersistedEndOfRoundSummary,
      setIsEndOfRoundModalDismissed,
      setIsBidModalOpen,
    })
  }

  const handleRemovedFromGame = (gameId, message = `You have been removed from game ${gameId}.`) => {
    if (gameId) {
      clearStoredGameSession(gameId)
    }

    clearActiveSessionState()
    setSessionInfo(null)
    setRequestError(message)
    clearGameIdInUrl()
  }

  const applyRealtimeResult = (
    result,
    role = getActiveSessionRole({ ownerSession, playerSession }) ?? 'player',
  ) => {
    applyResultToSessionRole({
      role,
      result,
      setOwnerSession,
      setPlayerSession,
    })
  }

  const requestActiveStateReview = async ({ associateConnection = false } = {}) => {
    const { role, session: activeSession } = getActiveSessionContext({ ownerSession, playerSession })
    if (!activeSession?.gameId || !activeSession?.playerToken) {
      return
    }

    try {
      const result = role === 'owner'
        ? await checkState({
            gameId: activeSession.gameId,
            playerToken: activeSession.playerToken,
            associateConnection,
          })
        : await getGameState({
            gameId: activeSession.gameId,
            playerToken: activeSession.playerToken,
            version: activeSession.version ?? activeSession.game?.version ?? 0,
            associateConnection,
          })

      applyRealtimeResult(result, role ?? 'player')
    } catch (error) {
      const messageText = error instanceof Error ? error.message.toLowerCase() : ''
      if (messageText.includes('invalid player token') || messageText.includes('game not found')) {
        logFrontendError('Unable to refresh game state', error)
        handleRemovedFromGame(activeSession.gameId)
        return
      }

      setGameError(toGenericErrorMessage(error, 'Unable to refresh game state.'))
    }
  }

  useEffect(() => {
    const { role, session } = getActiveSessionContext({ ownerSession, playerSession })

    if (session?.gameId && session?.playerToken && role) {
      setActiveGameSession({
        role,
        gameId: session.gameId,
        playerToken: session.playerToken,
      })
      return
    }

    setActiveGameSession(null)
  }, [ownerSession?.gameId, ownerSession?.playerToken, playerSession?.gameId, playerSession?.playerToken])

  useEffect(() => {
    return subscribeToGameEvents((event) => {
      if (event?.type === 'playerRemoved' || event?.type === 'gameRemoved') {
        handleRemovedFromGame(event.gameId, event.message)
        return
      }

      if (event?.type === 'sessionError') {
        const messageText = event.error instanceof Error ? event.error.message.toLowerCase() : ''
        logFrontendError('Session sync error', event.error)
        if (messageText.includes('invalid player token') || messageText.includes('game not found')) {
          handleRemovedFromGame(event.gameId)
        }
        return
      }

      if (event?.type !== 'gameState' && event?.type !== 'sessionSync') {
        return
      }

      const { role, session: activeSession } = getActiveSessionContext({ ownerSession, playerSession })
      if (!activeSession?.gameId || event.gameId !== activeSession.gameId) {
        return
      }

      applyRealtimeResult(event.result, role ?? 'player')
    })
  }, [ownerSession, playerSession])

  useEffect(() => {
    const gameIdFromUrl = getGameIdFromUrl()
    if (!gameIdFromUrl) {
      return undefined
    }

    let isCancelled = false
    sessionRestoreInitialized(gameIdFromUrl)

    const attemptSessionRestore = async () => {
      const storedSession = getStoredGameSession(gameIdFromUrl)
      if (!storedSession?.playerToken) {
        if (!isCancelled) {
          openJoinModal()
        }
        return
      }

      const restoredSession = await normalizeStoredSessionGame(
        gameIdFromUrl,
        storedSession.playerToken,
        storedSession.role,
      )

      if (isCancelled) {
        return
      }

      if (restoredSession?.role === 'owner') {
        const resumedSession = await returnFromAway({
          gameId: gameIdFromUrl,
          playerToken: storedSession.playerToken,
        })

        sessionRestoreSucceeded({
          role: 'owner',
          session: buildOwnerSession({
            gameId: gameIdFromUrl,
            playerToken: storedSession.playerToken,
            game: resumedSession?.game ?? restoredSession.game,
            ownerPlayerId: resumedSession?.ownerPlayerId ?? restoredSession.ownerPlayerId,
          }),
          selectedMaxCards: String(restoredSession.game?.options?.maxCards ?? 10),
          selectedAiDifficulty: restoredSession.game?.options?.aiDifficulty ?? 'medium',
        })
        closeJoinModal()
        saveStoredGameSession(
          gameIdFromUrl,
          storedSession.playerToken,
          'owner',
          getRestoredPlayerName(restoredSession, storedSession.playerName ?? '', getViewerHand),
        )
        return
      }

      if (restoredSession?.role === 'player') {
        const resumedSession = await returnFromAway({
          gameId: gameIdFromUrl,
          playerToken: storedSession.playerToken,
        })

        sessionRestoreSucceeded({
          role: 'player',
          session: buildPlayerSession({
            gameId: gameIdFromUrl,
            playerToken: storedSession.playerToken,
            game: resumedSession?.game ?? restoredSession.game,
            version: resumedSession?.version ?? restoredSession.version,
          }),
        })
        closeJoinModal()
        saveStoredGameSession(
          gameIdFromUrl,
          storedSession.playerToken,
          'player',
          getRestoredPlayerName(restoredSession, storedSession.playerName ?? '', getViewerHand),
        )
        return
      }

      clearStoredGameSession(gameIdFromUrl)
      if (!isCancelled) {
        if (storedSession?.role === 'player') {
          handleRemovedFromGame(gameIdFromUrl)
        } else {
          openJoinModal()
        }
      }
    }

    attemptSessionRestore()

    return () => {
      isCancelled = true
    }
  }, [])

  useEffect(() => {
    if (ownerSession?.gameId || playerSession?.gameId) {
      return undefined
    }

    if (getGameIdFromUrl()) {
      return undefined
    }

    let isCancelled = false

    const loadRejoinableGames = async () => {
      rejoinableGamesLoadingStarted()

      const storedSessions = await pruneMissingStoredGameSessions()
      const gameIds = Object.keys(storedSessions)

      if (gameIds.length === 0) {
        if (!isCancelled) {
          rejoinableGamesLoaded([])
        }
        return
      }

      const resolvedSessions = await Promise.all(
        gameIds.map(async (gameId) => {
          const storedSession = storedSessions[gameId]
          if (typeof storedSession?.playerToken !== 'string' || !storedSession.playerToken.trim()) {
            return null
          }

          const normalized = await normalizeStoredSessionGame(
            gameId,
            storedSession.playerToken,
            storedSession.role,
          )
          if (!normalized?.game || normalized.game.phase?.stage === 'GameOver') {
            return null
          }

          return {
            gameId,
            playerToken: storedSession.playerToken,
            playerName: getRestoredPlayerName(normalized, storedSession.playerName ?? '', getViewerHand),
            phase: normalized.game.phase?.stage ?? 'Unknown',
            role: normalized.role,
            updatedAt: storedSession.updatedAt ?? 0,
          }
        }),
      )

      if (isCancelled) {
        return
      }

      const nextRejoinableGames = resolvedSessions
        .filter(Boolean)
        .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))

      rejoinableGamesLoaded(nextRejoinableGames)
    }

    loadRejoinableGames()

    return () => {
      isCancelled = true
    }
  }, [ownerSession?.gameId, playerSession?.gameId])

  useEffect(() => {
    if (!activeGame) {
      return
    }

    if (hydratedRoundSummaryGameIdRef.current === activeGame.id) {
      return
    }

    hydratedRoundSummaryGameIdRef.current = activeGame.id
    latestShownRoundIndexRef.current = completedRoundCount > 0 ? completedRoundCount - 1 : -1
    setPersistedEndOfRoundSummary(
      completedRoundCount > 0 ? buildRoundSummary(activeGame, completedRoundCount - 1) : null,
    )
    setIsEndOfRoundModalDismissed(true)
  }, [activeGame, completedRoundCount, setPersistedEndOfRoundSummary, setIsEndOfRoundModalDismissed])

  useEffect(() => {
    const stage = activeGame?.phase?.stage
    const viewerCardCount = getViewerHand(activeGame)?.cards?.length ?? 0
    const dealKey =
      activeGame?.phase && 'cards' in activeGame.phase
        ? [
            activeGame.id,
            'roundIndex' in activeGame.phase ? activeGame.phase.roundIndex : 'no-round',
            activeGame.phase.cards.trump?.suit ?? 'no-trump-suit',
            activeGame.phase.cards.trump?.rank ?? 'no-trump-rank',
          ].join(':')
        : ''

    if ((stage !== 'Bidding' && stage !== 'Playing') || viewerCardCount === 0 || !dealKey) {
      return
    }

    if (lastDealtSortResetKeyRef.current === dealKey) {
      return
    }

    lastDealtSortResetKeyRef.current = dealKey
    setSortMode('byRank')
  }, [activeGame, setSortMode])

  useEffect(() => {
    if (gameErrorTimeoutRef.current) {
      clearTimeout(gameErrorTimeoutRef.current)
      gameErrorTimeoutRef.current = null
    }

    if (!gameError || activeGame?.phase?.stage !== 'Playing') {
      return
    }

    gameErrorTimeoutRef.current = setTimeout(() => {
      setGameError('')
      gameErrorTimeoutRef.current = null
    }, 2000)

    return () => {
      if (gameErrorTimeoutRef.current) {
        clearTimeout(gameErrorTimeoutRef.current)
        gameErrorTimeoutRef.current = null
      }
    }
  }, [activeGame?.phase?.stage, gameError, setGameError])

  useEffect(() => {
    if (!activeGame || completedRoundCount <= 0) {
      return
    }

    const latestCompletedRoundIndex = completedRoundCount - 1
    if (latestCompletedRoundIndex <= latestShownRoundIndexRef.current) {
      return
    }

    const summary = buildRoundSummary(activeGame, latestCompletedRoundIndex)
    if (!summary) {
      return
    }

    latestShownRoundIndexRef.current = latestCompletedRoundIndex
    setPersistedEndOfRoundSummary(summary)

    if (endOfRoundSummaryTimeoutRef.current) {
      clearTimeout(endOfRoundSummaryTimeoutRef.current)
      endOfRoundSummaryTimeoutRef.current = null
    }

    if (activeGame.phase?.stage === 'GameOver') {
      setIsEndOfRoundModalDismissed(true)
      return
    }

    setIsEndOfRoundModalDismissed(true)
    endOfRoundSummaryTimeoutRef.current = setTimeout(() => {
      setIsEndOfRoundModalDismissed(false)
      endOfRoundSummaryTimeoutRef.current = null
    }, TRICK_COMPLETE_DELAY_MS)

    return () => {
      if (endOfRoundSummaryTimeoutRef.current) {
        clearTimeout(endOfRoundSummaryTimeoutRef.current)
        endOfRoundSummaryTimeoutRef.current = null
      }
    }
  }, [activeGame, completedRoundCount, setPersistedEndOfRoundSummary, setIsEndOfRoundModalDismissed])

  useEffect(() => {
    if (!isOwnerLobby || ownerSession?.game?.phase?.stage !== 'Lobby') {
      previousLobbyMaxCardsRef.current = null
      return
    }

    const currentSelectedMaxCards = Number(selectedMaxCards)
    const previousLobbyMaxCards = previousLobbyMaxCardsRef.current
    previousLobbyMaxCardsRef.current = maxCardsForLobbySeatCount

    if (currentSelectedMaxCards <= maxCardsForLobbySeatCount) {
      if (
        previousLobbyMaxCards !== null &&
        maxCardsForLobbySeatCount > previousLobbyMaxCards &&
        currentSelectedMaxCards === previousLobbyMaxCards
      ) {
        setSelectedMaxCards(String(maxCardsForLobbySeatCount))
      }
      return
    }

    setSelectedMaxCards(String(maxCardsForLobbySeatCount))
  }, [
    isOwnerLobby,
    maxCardsForLobbySeatCount,
    ownerSession?.game?.phase?.stage,
    selectedMaxCards,
    setSelectedMaxCards,
  ])

  useEffect(() => {
    if (awayModalSessionKeyRef.current !== activeSessionKey) {
      awayModalSessionKeyRef.current = activeSessionKey
      wasLocalPlayerAwayRef.current = Boolean(isLocalPlayerMarkedAway)
      setShowAwayContinueModal(false)
      return
    }

    if (!activeSessionKey) {
      wasLocalPlayerAwayRef.current = false
      setShowAwayContinueModal(false)
      return
    }

    if (!wasLocalPlayerAwayRef.current && isLocalPlayerMarkedAway) {
      setShowAwayContinueModal(true)
    } else if (!isLocalPlayerMarkedAway) {
      setShowAwayContinueModal(false)
    }

    wasLocalPlayerAwayRef.current = Boolean(isLocalPlayerMarkedAway)
  }, [activeSessionKey, isLocalPlayerMarkedAway, setShowAwayContinueModal])

  useEffect(() => {
    let isCancelled = false

    if (!isLobbyShareModalOpen || !shareLink) {
      setShareQrCodeDataUrl('')
      return undefined
    }

    QRCode.toDataURL(shareLink, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
      color: {
        dark: '#0f172a',
        light: '#f8fafc',
      },
    })
      .then((url) => {
        if (!isCancelled) {
          setShareQrCodeDataUrl(url)
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setShareQrCodeDataUrl('')
          setLobbyInfo('Unable to generate QR code.')
        }
      })

    return () => {
      isCancelled = true
    }
  }, [isLobbyShareModalOpen, setLobbyInfo, setShareQrCodeDataUrl, shareLink])

  useEffect(() => {
    return () => {
      if (aiPauseTimeoutRef.current) {
        clearTimeout(aiPauseTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!activeLobbySession?.gameId || !activeLobbySession?.playerToken || !activeLobbySession?.game?.phase) {
      return undefined
    }

    if (activeLobbySession.game.phase.stage === 'Scoring') {
      const timeout = setTimeout(() => {
        void requestActiveStateReview()
      }, 0)

      return () => clearTimeout(timeout)
    }

    if (activeLobbySession.game.phase.stage === 'EndOfRound') {
      const delay = Math.max(0, (activeLobbySession.game.phase.advanceAfter ?? Date.now()) - Date.now())
      const timeout = setTimeout(() => {
        void requestActiveStateReview()
      }, delay)

      return () => clearTimeout(timeout)
    }

    return undefined
  }, [
    activeLobbySession?.gameId,
    activeLobbySession?.playerToken,
    activeLobbySession?.game?.phase?.stage,
    activeLobbySession?.game?.phase?.advanceAfter,
    ownerSession,
    playerSession,
  ])

  useEffect(() => {
    const completedTricks =
      activeGame?.phase && 'cards' in activeGame.phase ? activeGame.phase.cards.completedTricks ?? [] : []

    if (!activeLobbySession?.gameId || !activeGame) {
      previousCompletedTrickCountRef.current = completedTricks.length
      aiPauseUntilRef.current = 0
      return
    }

    const trickCountIncreased = completedTricks.length > previousCompletedTrickCountRef.current
    previousCompletedTrickCountRef.current = completedTricks.length

    if (!trickCountIncreased) {
      return
    }

    aiPauseUntilRef.current = Date.now() + TRICK_COMPLETE_DELAY_MS
    if (aiPauseTimeoutRef.current) {
      clearTimeout(aiPauseTimeoutRef.current)
    }
    aiPauseTimeoutRef.current = setTimeout(() => {
      aiPauseUntilRef.current = 0
      aiPauseTimeoutRef.current = null
    }, TRICK_COMPLETE_DELAY_MS)
  }, [activeGame, activeLobbySession?.gameId, ownerSession, playerSession])

  const handleCopyShareLink = async () => {
    if (!shareLink) {
      return
    }

    try {
      await navigator.clipboard.writeText(shareLink)
      setIsShareLinkCopied(true)
      if (shareLinkCopiedTimeoutRef.current) {
        clearTimeout(shareLinkCopiedTimeoutRef.current)
      }
      shareLinkCopiedTimeoutRef.current = setTimeout(() => {
        setIsShareLinkCopied(false)
        shareLinkCopiedTimeoutRef.current = null
      }, 2000)
    } catch {
      setLobbyInfo('Unable to copy automatically. Copy the link manually.')
    }
  }

  const resetActiveSessionState = () => {
    clearActiveSessionState()
    setSessionInfo(null)
    clearGameIdInUrl()
  }

  return {
    applyRealtimeResult,
    clearActiveSessionState,
    handleCopyShareLink,
    handleRemovedFromGame,
    isReactionOnCooldown,
    reactionCooldownTimeoutRef,
    requestActiveStateReview,
    resetActiveSessionState,
  }
}
