export const getActiveSession = ({ ownerSession, playerSession }) => ownerSession ?? playerSession

export const getActiveSessionContext = ({ ownerSession, playerSession }) => {
  const role = getActiveSessionRole({ ownerSession, playerSession })
  const session = getActiveSession({ ownerSession, playerSession })

  return {
    role,
    session,
  }
}

export const getActiveSessionRole = ({ ownerSession, playerSession }) => {
  if (ownerSession) {
    return 'owner'
  }

  if (playerSession) {
    return 'player'
  }

  return null
}

export const getRestoredPlayerName = (restoredSession, fallbackName = '', getViewerHand) => {
  if (fallbackName) {
    return fallbackName
  }

  if (!restoredSession?.game) {
    return ''
  }

  if (restoredSession.role === 'owner') {
    const ownerPlayerId = restoredSession.ownerPlayerId
    return restoredSession.game.players?.find((player) => player.id === ownerPlayerId)?.name ?? ''
  }

  const viewerPlayerId = getViewerHand(restoredSession.game)?.playerId
  return restoredSession.game.players?.find((player) => player.id === viewerPlayerId)?.name ?? ''
}

export const getResultVersion = (result) => result?.version ?? result?.game?.version ?? 0

export const isConcurrentUpdateError = (error) => {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return message.includes('TransactionConflict') || message.includes('Transaction cancelled')
}

const shouldApplyGameVersion = (currentVersion, nextVersion) =>
  typeof nextVersion !== 'number' || nextVersion >= currentVersion

export const mergeOwnerSessionResult = (previousSession, result) => {
  if (!previousSession || !result?.game) {
    return previousSession
  }

  const currentVersion = previousSession.game?.version ?? 0
  const nextVersion = getResultVersion(result)
  if (!shouldApplyGameVersion(currentVersion, nextVersion)) {
    return previousSession
  }

  return {
    ...previousSession,
    game: result.game,
  }
}

export const mergePlayerSessionResult = (previousSession, result) => {
  if (!previousSession || !result?.game) {
    return previousSession
  }

  const currentVersion = previousSession.version ?? previousSession.game?.version ?? 0
  const nextVersion = getResultVersion(result)
  if (!shouldApplyGameVersion(currentVersion, nextVersion)) {
    return previousSession
  }

  return {
    ...previousSession,
    game: result.game,
    version: nextVersion,
  }
}

export const buildOwnerSession = ({
  gameId,
  playerToken,
  game,
  ownerPlayerId,
}) => ({
  gameId,
  playerToken,
  game,
  ownerPlayerId,
})

export const buildPlayerSession = ({
  gameId,
  playerToken,
  game,
  version,
}) => ({
  gameId,
  playerToken,
  game,
  version,
})

export const setSessionForRole = ({
  role,
  session,
  setOwnerSession,
  setPlayerSession,
}) => {
  if (role === 'owner') {
    setOwnerSession(session)
    setPlayerSession(null)
    return
  }

  if (role === 'player') {
    setPlayerSession(session)
    setOwnerSession(null)
  }
}

export const applyResultToSessionRole = ({
  role,
  result,
  setOwnerSession,
  setPlayerSession,
}) => {
  if (!result?.game) {
    return
  }

  if (role === 'owner') {
    setOwnerSession((previousSession) => mergeOwnerSessionResult(previousSession, result))
    return
  }

  if (role === 'player') {
    setPlayerSession((previousSession) => mergePlayerSessionResult(previousSession, result))
  }
}

export const clearTimeoutRef = (timeoutRef) => {
  if (!timeoutRef?.current) {
    return
  }

  clearTimeout(timeoutRef.current)
  timeoutRef.current = null
}

export const clearTimeoutRefs = (timeoutRefs) => {
  timeoutRefs.forEach(clearTimeoutRef)
}

export const resetRealtimeTrackingState = ({
  aiPauseUntilRef,
  previousCompletedTrickCountRef,
  latestShownRoundIndexRef,
  hydratedRoundSummaryGameIdRef,
}) => {
  aiPauseUntilRef.current = 0
  previousCompletedTrickCountRef.current = 0
  latestShownRoundIndexRef.current = -1
  hydratedRoundSummaryGameIdRef.current = ''
}

export const clearActiveSessionState = ({
  timeoutRefs,
  trackingRefs,
  setOwnerSession,
  setPlayerSession,
  setGameError,
  setLobbyInfo,
  setPersistedEndOfRoundSummary,
  setIsEndOfRoundModalDismissed,
  setIsBidModalOpen,
}) => {
  clearTimeoutRefs(timeoutRefs)
  resetRealtimeTrackingState(trackingRefs)
  setOwnerSession(null)
  setPlayerSession(null)
  setGameError('')
  setLobbyInfo('')
  setPersistedEndOfRoundSummary(null)
  setIsEndOfRoundModalDismissed(false)
  setIsBidModalOpen(false)
}
