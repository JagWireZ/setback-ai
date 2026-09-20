import { createRequire } from 'node:module'
import { WebSocketServer } from 'ws'

// A local stand-in for the API Gateway WebSocket + Lambda + DynamoDB stack used in
// production. It drives the *real* compiled backend handler/reducer/AI stack (built via
// `npm run build:backend`) in-process, backed by an in-memory game/connection store instead
// of DynamoDB, and pipes handler output back over real WebSocket connections instead of the
// API Gateway Management API -- the same substitution `backend/test/fullGameFlow.test.js`
// makes for its in-process integration test, just wired up to real sockets so a browser can
// drive it end to end.

const require = createRequire(import.meta.url)

const handlerModule = require('../backend/dist/backend/src/handler.js')
const websocketModule = require('../backend/dist/backend/src/websocket.js')
const getGameByIdModule = require('../backend/dist/backend/engine/helpers/reducer/storage/getGameById.js')
const putGameModule = require('../backend/dist/backend/engine/helpers/reducer/storage/putGame.js')
const putConnectionModule = require('../backend/dist/backend/engine/helpers/reducer/storage/putConnection.js')
const getConnectionsByGameIdModule = require('../backend/dist/backend/engine/helpers/reducer/storage/getConnectionsByGameId.js')
const deleteConnectionByIdModule = require('../backend/dist/backend/engine/helpers/reducer/storage/deleteConnectionById.js')
const turnTimingModule = require('../backend/dist/backend/engine/helpers/reducer/gameState/turnTiming.js')
const reviewGameStateModule = require('../backend/dist/backend/engine/ai/reviewGameState.js')
const toResultModule = require('../backend/dist/backend/engine/helpers/reducer/gameState/toResult.js')

const games = new Map()
const connectionRecords = new Map()
const sockets = new Map()

getGameByIdModule.getGameById = async (gameId) => games.get(gameId)
putGameModule.putGame = async (game) => {
  games.set(game.id, game)
}
putConnectionModule.putConnection = async (connectionId, gameId, playerToken) => {
  connectionRecords.set(connectionId, { connectionId, gameId, playerToken })
}
getConnectionsByGameIdModule.getConnectionsByGameId = async (gameId) =>
  [...connectionRecords.values()].filter((connection) => connection.gameId === gameId)
deleteConnectionByIdModule.deleteConnectionById = async (connectionId) => {
  connectionRecords.delete(connectionId)
}

websocketModule.sendSocketResponse = async (_domainName, _stage, connectionId, message) => {
  const ws = sockets.get(connectionId)
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message))
  }
}

// Reimplements the essential contract of the real `broadcastGameState` (personalized
// gameState push per connected player) against the in-memory store/sockets above instead of
// DynamoDB + the API Gateway Management API.
websocketModule.broadcastGameState = async (_domainName, _stage, gameId) => {
  const [connections, game] = await Promise.all([
    getConnectionsByGameIdModule.getConnectionsByGameId(gameId),
    getGameByIdModule.getGameById(gameId),
  ])

  if (!game) {
    for (const connection of connections) {
      const ws = sockets.get(connection.connectionId)
      ws?.send(
        JSON.stringify({
          type: 'gameRemoved',
          gameId,
          message: `Game ${gameId} is no longer available.`,
        })
      )
      connectionRecords.delete(connection.connectionId)
    }
    return
  }

  for (const connection of connections) {
    const stillHasSeat = game.playerTokens.some((entry) => entry.token === connection.playerToken)
    const ws = sockets.get(connection.connectionId)

    if (!stillHasSeat) {
      ws?.send(
        JSON.stringify({
          type: 'playerRemoved',
          gameId,
          message: `You have been removed from game ${gameId}.`,
        })
      )
      connectionRecords.delete(connection.connectionId)
      continue
    }

    ws?.send(
      JSON.stringify({
        type: 'gameState',
        gameId,
        result: toResultModule.toResult(game, undefined, connection.playerToken),
      })
    )
  }
}

// AI/automation timing (turn delays, trick-reveal delay) is real-world-clock based so the
// production UI can animate. Collapsing any "due in the future" moment down to "due now"
// keeps E2E runs fast and deterministic instead of sleeping through real delays -- mirrors
// the same override `backend/test/fullGameFlow.test.js` uses.
const originalGetAutomationDueAt = turnTimingModule.getAutomationDueAt
turnTimingModule.getAutomationDueAt = (game) => {
  const dueAt = originalGetAutomationDueAt(game)
  return typeof dueAt === 'number' ? Date.now() : undefined
}

const originalAdvanceDueAutomation = reviewGameStateModule.advanceDueAutomation
reviewGameStateModule.advanceDueAutomation = (game) =>
  originalAdvanceDueAutomation(game, Number.POSITIVE_INFINITY)

let nextConnectionId = 1

const port = Number.parseInt(process.env.MOCK_BACKEND_PORT ?? '8787', 10)
const wss = new WebSocketServer({ port })

wss.on('connection', (ws) => {
  const connectionId = `conn-${nextConnectionId}`
  nextConnectionId += 1
  sockets.set(connectionId, ws)

  ws.on('message', async (data) => {
    let body
    try {
      body = JSON.parse(data.toString())
    } catch {
      return
    }

    await handlerModule.handler({
      requestContext: {
        connectionId,
        domainName: 'localhost',
        stage: 'e2e',
        routeKey: '$default',
      },
      body: JSON.stringify(body),
    })
  })

  ws.on('close', () => {
    sockets.delete(connectionId)
    connectionRecords.delete(connectionId)
  })
})

wss.on('listening', () => {
  console.log(`Mock backend WebSocket server listening on ws://localhost:${port}`)
})
