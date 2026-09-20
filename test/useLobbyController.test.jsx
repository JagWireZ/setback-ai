import test from 'node:test'
import assert from 'node:assert/strict'
import { mock } from 'node:test'
import '../test/setupDom.js'
import { renderHook, cleanup } from '@testing-library/react'

const lambdaClientUrl = new URL('../src/api/lambdaClient.js', import.meta.url).href

const addSeatMock = mock.fn()
const movePlayerMock = mock.fn()
const removePlayerMock = mock.fn()
const removeSeatMock = mock.fn()
const startGameMock = mock.fn()

mock.module(lambdaClientUrl, {
  exports: {
    addSeat: (...args) => addSeatMock(...args),
    movePlayer: (...args) => movePlayerMock(...args),
    removePlayer: (...args) => removePlayerMock(...args),
    removeSeat: (...args) => removeSeatMock(...args),
    startGame: (...args) => startGameMock(...args),
    checkState: async () => ({}),
    getGameState: async () => ({}),
  },
})

const { useLobbyController } = await import('../src/hooks/useLobbyController.js')

test.afterEach(() => {
  cleanup()
  for (const fn of [addSeatMock, movePlayerMock, removePlayerMock, removeSeatMock, startGameMock]) {
    fn.mock.resetCalls()
  }
})

const buildActions = () => ({
  setGameError: mock.fn(),
  setIsStartingGame: mock.fn(),
  setLobbyInfo: mock.fn(),
  setPendingPlayerActionId: mock.fn(),
})

const buildAppState = (ownerSession, overrides = {}) => ({
  session: { ownerSession, playerSession: null },
  game: { selectedAiDifficulty: 'medium', selectedMaxCards: '8', ...overrides },
})

const ownerGame = {
  id: 'game-1',
  phase: { stage: 'Lobby', dealerPlayerId: 'p2' },
  playerOrder: ['p1', 'p2'],
  players: [
    { id: 'p1', name: 'Casey', type: 'human' },
    { id: 'p2', name: 'Robin', type: 'ai' },
  ],
  scores: [],
  options: { rounds: [] },
}

test('all owner actions are no-ops without an owner session', async () => {
  const appActions = buildActions()
  const applyRealtimeResult = mock.fn()
  const { result } = renderHook(() =>
    useLobbyController({ appState: buildAppState(null), appActions, applyRealtimeResult }),
  )

  await result.current.handleMovePlayer('p1', 'up')
  await result.current.handleRemovePlayer('p1')
  const addSeatResult = await result.current.handleAddSeat()
  const removeSeatResult = await result.current.handleRemoveSeat('p1')
  await result.current.handleStartGame()

  assert.equal(addSeatMock.mock.calls.length, 0)
  assert.equal(movePlayerMock.mock.calls.length, 0)
  assert.equal(removePlayerMock.mock.calls.length, 0)
  assert.equal(removeSeatMock.mock.calls.length, 0)
  assert.equal(startGameMock.mock.calls.length, 0)
  assert.equal(addSeatResult, false)
  assert.equal(removeSeatResult, false)
})

test('handleMovePlayer clears feedback, tracks the pending action, and applies the result', async () => {
  movePlayerMock.mock.mockImplementation(async () => ({ game: { id: 'game-1' } }))
  const appActions = buildActions()
  const applyRealtimeResult = mock.fn()
  const ownerSession = { gameId: 'game-1', playerToken: 'owner-token', game: ownerGame }
  const { result } = renderHook(() =>
    useLobbyController({ appState: buildAppState(ownerSession), appActions, applyRealtimeResult }),
  )

  await result.current.handleMovePlayer('p1', 'up')

  assert.deepEqual(movePlayerMock.mock.calls[0].arguments[0], {
    gameId: 'game-1',
    playerToken: 'owner-token',
    playerId: 'p1',
    direction: 'up',
  })
  assert.equal(applyRealtimeResult.mock.calls[0].arguments[1], 'owner')
  assert.equal(appActions.setPendingPlayerActionId.mock.calls[0].arguments[0], 'p1')
  assert.equal(appActions.setPendingPlayerActionId.mock.calls.at(-1).arguments[0], '')
})

test('handleMovePlayer surfaces a generic error message on failure', async () => {
  movePlayerMock.mock.mockImplementation(async () => {
    throw new Error('Owner token required')
  })
  const appActions = buildActions()
  const ownerSession = { gameId: 'game-1', playerToken: 'owner-token', game: ownerGame }
  const { result } = renderHook(() =>
    useLobbyController({ appState: buildAppState(ownerSession), appActions, applyRealtimeResult: mock.fn() }),
  )

  await result.current.handleMovePlayer('p1', 'up')

  assert.equal(appActions.setGameError.mock.calls.at(-1).arguments[0], 'Unable to move player.')
})

test('handleAddSeat applies the result and reports success info', async () => {
  addSeatMock.mock.mockImplementation(async () => ({ game: { id: 'game-1' } }))
  const appActions = buildActions()
  const applyRealtimeResult = mock.fn()
  const ownerSession = { gameId: 'game-1', playerToken: 'owner-token', game: ownerGame }
  const { result } = renderHook(() =>
    useLobbyController({ appState: buildAppState(ownerSession), appActions, applyRealtimeResult }),
  )

  const outcome = await result.current.handleAddSeat()

  assert.equal(outcome, true)
  assert.equal(appActions.setLobbyInfo.mock.calls.at(-1).arguments[0], 'Seat added.')
  assert.equal(applyRealtimeResult.mock.calls.length, 1)
})

test('handleRemoveSeat reports failure and does not set the success message', async () => {
  removeSeatMock.mock.mockImplementation(async () => {
    throw new Error('boom')
  })
  const appActions = buildActions()
  const ownerSession = { gameId: 'game-1', playerToken: 'owner-token', game: ownerGame }
  const { result } = renderHook(() =>
    useLobbyController({ appState: buildAppState(ownerSession), appActions, applyRealtimeResult: mock.fn() }),
  )

  const outcome = await result.current.handleRemoveSeat('p2')

  assert.equal(outcome, false)
  assert.equal(appActions.setGameError.mock.calls.at(-1).arguments[0], 'Unable to remove seat.')
  assert.ok(!appActions.setLobbyInfo.mock.calls.some((call) => call.arguments[0] === 'Seat removed.'))
})

test('handleStartGame sends the selected max cards, dealer, and difficulty', async () => {
  startGameMock.mock.mockImplementation(async () => ({ game: { id: 'game-1' } }))
  const appActions = buildActions()
  const applyRealtimeResult = mock.fn()
  const ownerSession = { gameId: 'game-1', playerToken: 'owner-token', game: ownerGame }
  const { result } = renderHook(() =>
    useLobbyController({
      appState: buildAppState(ownerSession, { selectedAiDifficulty: 'hard', selectedMaxCards: '6' }),
      appActions,
      applyRealtimeResult,
    }),
  )

  await result.current.handleStartGame()

  assert.deepEqual(startGameMock.mock.calls[0].arguments[0], {
    gameId: 'game-1',
    playerToken: 'owner-token',
    maxCards: 6,
    dealerPlayerId: 'p1',
    aiDifficulty: 'hard',
  })
  assert.equal(appActions.setIsStartingGame.mock.calls[0].arguments[0], true)
  assert.equal(appActions.setIsStartingGame.mock.calls.at(-1).arguments[0], false)
  assert.equal(appActions.setLobbyInfo.mock.calls.at(-1).arguments[0], 'Game started.')
})

test('currentDealerPlayerId prefers the game phase dealer over the first ordered player', () => {
  const appActions = buildActions()
  const ownerSession = { gameId: 'game-1', playerToken: 'owner-token', game: ownerGame }
  const { result } = renderHook(() =>
    useLobbyController({ appState: buildAppState(ownerSession), appActions, applyRealtimeResult: mock.fn() }),
  )

  assert.equal(result.current.currentDealerPlayerId, 'p2')
})

test('exposes the AI difficulty options and max seat constant', () => {
  const appActions = buildActions()
  const { result } = renderHook(() =>
    useLobbyController({ appState: buildAppState(null), appActions, applyRealtimeResult: mock.fn() }),
  )

  assert.ok(result.current.aiDifficultyOptions.some((option) => option.value === 'hard'))
  assert.equal(typeof result.current.maxSeats, 'number')
})
