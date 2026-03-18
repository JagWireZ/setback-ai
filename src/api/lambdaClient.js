const requiredEnv = (name) => {
  const value = import.meta.env[name]
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value.trim()
}

const normalizeGameId = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value

const normalizeWebSocketUrl = (value) => {
  if (value.startsWith('wss://') || value.startsWith('ws://')) {
    return value
  }

  if (value.startsWith('https://')) {
    return `wss://${value.slice('https://'.length)}`
  }

  if (value.startsWith('http://')) {
    return `ws://${value.slice('http://'.length)}`
  }

  return value
}

const websocketUrl = normalizeWebSocketUrl(requiredEnv('VITE_WEBSOCKET_URL'))

let socket = null
let connectPromise = null
let reconnectTimeoutId = null
let nextRequestId = 1
let activeSession = null

const listeners = new Set()
const pendingRequests = new Map()

const emit = (event) => {
  listeners.forEach((listener) => {
    try {
      listener(event)
    } catch (error) {
      console.error('WebSocket event listener failed', error)
    }
  })
}

const rejectPendingRequests = (message) => {
  pendingRequests.forEach(({ reject }) => reject(new Error(message)))
  pendingRequests.clear()
}

const scheduleReconnect = () => {
  if (reconnectTimeoutId || !activeSession) {
    return
  }

  reconnectTimeoutId = window.setTimeout(() => {
    reconnectTimeoutId = null
    void ensureSocket().catch(() => {
      scheduleReconnect()
    })
  }, 1000)
}

const handleSocketMessage = (event) => {
  let message

  try {
    message = JSON.parse(event.data)
  } catch {
    return
  }

  if (message?.type === 'response' && typeof message.requestId === 'string') {
    const pending = pendingRequests.get(message.requestId)
    if (!pending) {
      return
    }

    pendingRequests.delete(message.requestId)
    if (message.ok) {
      pending.resolve(message.result)
    } else {
      pending.reject(new Error(typeof message.error === 'string' ? message.error : 'Request failed'))
    }
    return
  }

  if (message?.type === 'gameState' || message?.type === 'playerRemoved' || message?.type === 'gameRemoved') {
    emit(message)
  }
}

const connectSocket = () =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(websocketUrl)

    ws.addEventListener('open', () => {
      socket = ws
      connectPromise = null
      resolve(ws)
      if (activeSession) {
        void syncActiveSession({ silent: true })
      }
    })

    ws.addEventListener('message', handleSocketMessage)

    ws.addEventListener('close', () => {
      if (socket === ws) {
        socket = null
      }
      connectPromise = null
      rejectPendingRequests('Connection closed')
      scheduleReconnect()
    })

    ws.addEventListener('error', () => {
      // The close handler deals with reconnect behavior.
    })

    ws.addEventListener('open', () => {
      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId)
        reconnectTimeoutId = null
      }
    })

    ws.addEventListener('close', () => {
      if (!socket) {
        reject(new Error('Unable to connect to WebSocket server'))
      }
    })
  })

const ensureSocket = async () => {
  if (socket?.readyState === WebSocket.OPEN) {
    return socket
  }

  if (connectPromise) {
    return connectPromise
  }

  connectPromise = connectSocket()
  return connectPromise
}

export const subscribeToGameEvents = (listener) => {
  listeners.add(listener)
  void ensureSocket().catch(() => {
    scheduleReconnect()
  })

  return () => {
    listeners.delete(listener)
  }
}

const invoke = async (action, payload) => {
  const ws = await ensureSocket()
  const requestId = `req-${nextRequestId}`
  nextRequestId += 1

  return new Promise((resolve, reject) => {
    pendingRequests.set(requestId, { resolve, reject })

    try {
      ws.send(JSON.stringify({
        requestId,
        action,
        payload,
      }))
    } catch (error) {
      pendingRequests.delete(requestId)
      reject(error instanceof Error ? error : new Error('Unable to send request'))
    }
  })
}

const syncActiveSession = async ({ silent = false } = {}) => {
  if (!activeSession?.gameId || !activeSession?.playerToken || !activeSession?.role) {
    return null
  }

  try {
    const result = await invoke(
      activeSession.role === 'owner' ? 'checkState' : 'getGameState',
      activeSession.role === 'owner'
        ? {
            gameId: activeSession.gameId,
            playerToken: activeSession.playerToken,
            associateConnection: true,
          }
        : {
            gameId: activeSession.gameId,
            playerToken: activeSession.playerToken,
            version: 0,
            associateConnection: true,
          },
    )

    emit({
      type: 'sessionSync',
      role: activeSession.role,
      gameId: activeSession.gameId,
      result,
    })

    return result
  } catch (error) {
    if (!silent) {
      emit({
        type: 'sessionError',
        role: activeSession.role,
        gameId: activeSession.gameId,
        error: error instanceof Error ? error : new Error('Unable to sync session'),
      })
    }
    throw error
  }
}

export const setActiveGameSession = (session) => {
  const nextSessionKey = session
    ? `${session.role}:${session.gameId}:${session.playerToken}`
    : ''
  const currentSessionKey = activeSession
    ? `${activeSession.role}:${activeSession.gameId}:${activeSession.playerToken}`
    : ''

  activeSession = session

  if (nextSessionKey === currentSessionKey) {
    return
  }

  if (activeSession) {
    if (socket?.readyState === WebSocket.OPEN) {
      void syncActiveSession({ silent: true }).catch(() => {
        scheduleReconnect()
      })
      return
    }

    void ensureSocket().catch(() => {
      scheduleReconnect()
    })
  }
}

export const invokeLambda = (action, payload) => invoke(action, payload)

export const createGame = ({ playerName }) =>
  invoke('createGame', {
    playerName,
  })

export const joinGame = ({ gameId, playerName }) =>
  invoke('joinGame', {
    gameId: normalizeGameId(gameId),
    playerName,
  })

export const checkState = ({ gameId, playerToken, associateConnection = false }) =>
  invoke('checkState', {
    gameId: normalizeGameId(gameId),
    playerToken,
    associateConnection,
  })

export const getGameState = ({ gameId, playerToken, version, associateConnection = false }) =>
  invoke('getGameState', {
    gameId: normalizeGameId(gameId),
    playerToken,
    version,
    associateConnection,
  })

export const movePlayer = ({ gameId, playerToken, playerId, direction }) =>
  invoke('movePlayer', {
    gameId: normalizeGameId(gameId),
    playerToken,
    playerId,
    direction,
  })

export const addSeat = ({ gameId, playerToken }) =>
  invoke('addSeat', {
    gameId: normalizeGameId(gameId),
    playerToken,
  })

export const removeSeat = ({ gameId, playerToken, playerId }) =>
  invoke('removeSeat', {
    gameId: normalizeGameId(gameId),
    playerToken,
    playerId,
  })

export const setPlayerAway = ({ gameId, playerToken, playerId }) =>
  invoke('setPlayerAway', {
    gameId: normalizeGameId(gameId),
    playerToken,
    playerId,
  })

export const removePlayer = ({ gameId, playerToken, playerId }) =>
  invoke('removePlayer', {
    gameId: normalizeGameId(gameId),
    playerToken,
    playerId,
  })

export const renamePlayer = ({ gameId, playerToken, playerName, playerId }) =>
  invoke('renamePlayer', {
    gameId: normalizeGameId(gameId),
    playerToken,
    playerName,
    ...(playerId ? { playerId } : {}),
  })

export const sendReaction = ({ gameId, playerToken, emoji }) =>
  invoke('sendReaction', {
    gameId: normalizeGameId(gameId),
    playerToken,
    emoji,
  })

export const startGame = ({ gameId, playerToken, maxCards, dealerPlayerId, aiDifficulty }) =>
  invoke('startGame', {
    gameId: normalizeGameId(gameId),
    playerToken,
    maxCards,
    dealerPlayerId,
    ...(aiDifficulty ? { aiDifficulty } : {}),
  })

export const startOver = ({ gameId, playerToken }) =>
  invoke('startOver', {
    gameId: normalizeGameId(gameId),
    playerToken,
  })

export const dealCards = ({ gameId, playerToken }) =>
  invoke('dealCards', {
    gameId: normalizeGameId(gameId),
    playerToken,
  })

export const submitBid = ({ gameId, playerToken, bid, trip }) =>
  invoke('submitBid', {
    gameId: normalizeGameId(gameId),
    playerToken,
    bid,
    ...(typeof trip === 'boolean' ? { trip } : {}),
  })

export const playCard = ({ gameId, playerToken, card }) =>
  invoke('playCard', {
    gameId: normalizeGameId(gameId),
    playerToken,
    card,
  })

export const returnFromAway = ({ gameId, playerToken }) =>
  invoke('returnFromAway', {
    gameId: normalizeGameId(gameId),
    playerToken,
  })

export const coverAwayPlayerTurn = ({ gameId, playerToken, playerId }) =>
  invoke('coverAwayPlayerTurn', {
    gameId: normalizeGameId(gameId),
    playerToken,
    playerId,
  })

export const sortCards = ({ gameId, playerToken, mode }) =>
  invoke('sortCards', {
    gameId: normalizeGameId(gameId),
    playerToken,
    mode,
  })
