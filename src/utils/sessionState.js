export const getActiveSession = ({ ownerSession, playerSession }) => ownerSession ?? playerSession

export const getActiveSessionRole = ({ ownerSession, playerSession }) => {
  if (ownerSession) {
    return 'owner'
  }

  if (playerSession) {
    return 'player'
  }

  return null
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
