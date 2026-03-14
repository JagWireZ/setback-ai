import { checkState, getGameState } from '../api/lambdaClient'

const GAME_SESSIONS_STORAGE_KEY = 'setback.gameSessions.v1'

const readStoredSessions = () => {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const raw = window.localStorage.getItem(GAME_SESSIONS_STORAGE_KEY)
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

const writeStoredSessions = (sessions) => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(GAME_SESSIONS_STORAGE_KEY, JSON.stringify(sessions))
}

export const saveStoredGameSession = (gameId, playerToken, role, playerName = '') => {
  if (!gameId || !playerToken) {
    return
  }

  const sessions = readStoredSessions()
  sessions[gameId] = {
    playerToken,
    role,
    playerName,
    updatedAt: Date.now(),
  }
  writeStoredSessions(sessions)
}

export const getStoredGameSession = (gameId) => {
  if (!gameId) {
    return null
  }

  const sessions = readStoredSessions()
  const session = sessions[gameId]
  if (!session || typeof session.playerToken !== 'string' || !session.playerToken.trim()) {
    return null
  }

  return session
}

export const clearStoredGameSession = (gameId) => {
  if (!gameId) {
    return
  }

  const sessions = readStoredSessions()
  delete sessions[gameId]
  writeStoredSessions(sessions)
}

const isGameNotFoundError = (error) => {
  const message = error instanceof Error ? error.message : ''
  return message.toLowerCase().includes('game not found')
}

const isInvalidPlayerTokenError = (error) => {
  const message = error instanceof Error ? error.message : ''
  return message.toLowerCase().includes('invalid player token')
}

const isOwnerTokenRequiredError = (error) => {
  const message = error instanceof Error ? error.message : ''
  return message.toLowerCase().includes('owner token required')
}

export const pruneMissingStoredGameSessions = async () => {
  const storedSessions = readStoredSessions()
  const entries = Object.entries(storedSessions)

  if (entries.length === 0) {
    return storedSessions
  }

  const nextSessions = { ...storedSessions }

  await Promise.all(
    entries.map(async ([gameId, storedSession]) => {
      if (typeof storedSession?.playerToken !== 'string' || !storedSession.playerToken.trim()) {
        delete nextSessions[gameId]
        return
      }

      try {
        await getGameState({
          gameId,
          playerToken: storedSession.playerToken,
          version: 0,
        })
      } catch (error) {
        if (isGameNotFoundError(error) || isInvalidPlayerTokenError(error)) {
          delete nextSessions[gameId]
        }
      }
    }),
  )

  writeStoredSessions(nextSessions)
  return nextSessions
}

export const getGameIdFromUrl = () => {
  if (typeof window === 'undefined') {
    return ''
  }

  const params = new URL(window.location.href).searchParams
  return params.get('gameid')?.trim() ?? params.get('gameId')?.trim() ?? ''
}

export const setGameIdInUrl = (gameId) => {
  if (typeof window === 'undefined' || !gameId) {
    return
  }

  const url = new URL(window.location.href)
  url.searchParams.set('gameid', gameId)
  url.searchParams.delete('gameId')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

export const clearGameIdInUrl = () => {
  if (typeof window === 'undefined') {
    return
  }

  const url = new URL(window.location.href)
  url.searchParams.delete('gameid')
  url.searchParams.delete('gameId')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

export const normalizeStoredSessionGame = async (gameId, playerToken, preferredRole) => {
  const tryOwnerRestore = async () => {
    const ownerResult = await checkState({
      gameId,
      playerToken,
    })

    if (!ownerResult?.game) {
      return null
    }

    const ownerPlayerId = ownerResult.game.players?.find((player) => player.type === 'human')?.id ?? ''
    return {
      role: 'owner',
      game: ownerResult.game,
      playerToken,
      ownerPlayerId,
    }
  }

  const tryPlayerRestore = async () => {
    const playerResult = await getGameState({
      gameId,
      playerToken,
      version: 0,
    })

    if (!playerResult?.game) {
      return null
    }

    return {
      role: 'player',
      game: playerResult.game,
      playerToken,
      version: playerResult?.version ?? playerResult.game?.version ?? 0,
    }
  }

  if (preferredRole === 'player') {
    try {
      return await tryPlayerRestore()
    } catch {
      return null
    }
  }

  if (preferredRole === 'owner') {
    try {
      return await tryOwnerRestore()
    } catch (error) {
      if (
        isGameNotFoundError(error) ||
        isInvalidPlayerTokenError(error) ||
        isOwnerTokenRequiredError(error)
      ) {
        return null
      }
    }

    return null
  }

  try {
    const ownerSession = await tryOwnerRestore()
    if (ownerSession) {
      return ownerSession
    }
  } catch {
    // Fallback to player lookup below.
  }

  try {
    return await tryPlayerRestore()
  } catch {
    return null
  }
}
