import test from 'node:test'
import assert from 'node:assert/strict'
import { mock } from 'node:test'
import '../test/setupDom.js'

const lambdaClientUrl = new URL('../src/api/lambdaClient.js', import.meta.url).href

const createGameMock = mock.fn()
const joinGameMock = mock.fn()
const renamePlayerMock = mock.fn()
const returnFromAwayMock = mock.fn()
const checkStateMock = mock.fn()
const getGameStateMock = mock.fn()

mock.module(lambdaClientUrl, {
  exports: {
    createGame: (...args) => createGameMock(...args),
    joinGame: (...args) => joinGameMock(...args),
    renamePlayer: (...args) => renamePlayerMock(...args),
    returnFromAway: (...args) => returnFromAwayMock(...args),
    checkState: (...args) => checkStateMock(...args),
    getGameState: (...args) => getGameStateMock(...args),
  },
})

const { useSessionActions } = await import('../src/hooks/useSessionActions.js')

test.beforeEach(() => {
  window.localStorage.clear()
  for (const fn of [createGameMock, joinGameMock, renamePlayerMock, returnFromAwayMock, checkStateMock, getGameStateMock]) {
    fn.mock.resetCalls()
    fn.mock.restore?.()
  }
})

const noopEvent = { preventDefault: () => {} }

const buildActions = () => ({
  createGameFailed: mock.fn(),
  createGameStarted: mock.fn(),
  createGameSucceeded: mock.fn(),
  createGameValidationFailed: mock.fn(),
  joinGameFailed: mock.fn(),
  joinGameStarted: mock.fn(),
  joinGameSucceeded: mock.fn(),
  joinGameValidationFailed: mock.fn(),
  rejoinGameFailed: mock.fn(),
  rejoinGameStarted: mock.fn(),
  rejoinGameSucceeded: mock.fn(),
  sessionFeedbackCleared: mock.fn(),
  setGameError: mock.fn(),
  setIsRenamingPlayer: mock.fn(),
  setLobbyInfo: mock.fn(),
})

const buildAppState = (overrides = {}) => ({
  home: {
    joinGameId: '',
    joinPlayerName: '',
    playerName: '',
    rejoinableGames: [],
    selectedRejoinGameId: '',
    ...overrides.home,
  },
  session: {
    ownerSession: null,
    playerSession: null,
    ...overrides.session,
  },
})

test('handleCreateGame reports validation errors and never calls the API for a blank name', async () => {
  const appActions = buildActions()
  const appState = buildAppState({ home: { playerName: '   ' } })
  const { handleCreateGame } = useSessionActions({
    appState,
    appActions,
    activeLobbyPlayerId: '',
    closeCreateModal: mock.fn(),
    closeJoinModal: mock.fn(),
    applyRealtimeResult: mock.fn(),
  })

  await handleCreateGame(noopEvent)

  assert.equal(createGameMock.mock.calls.length, 0)
  assert.equal(appActions.createGameValidationFailed.mock.calls.length, 1)
  assert.deepEqual(appActions.createGameValidationFailed.mock.calls[0].arguments[0], {
    playerName: 'Player Name is required.',
  })
})

test('handleCreateGame succeeds, persists the session, and closes the modal', async () => {
  createGameMock.mock.mockImplementation(async () => ({
    game: { id: 'game-1', players: [{ id: 'p1', type: 'human' }], options: { maxCards: 8, aiDifficulty: 'hard' } },
    playerToken: 'owner-token',
  }))

  const appActions = buildActions()
  const appState = buildAppState({ home: { playerName: 'Casey' } })
  const closeCreateModal = mock.fn()
  const { handleCreateGame } = useSessionActions({
    appState,
    appActions,
    activeLobbyPlayerId: '',
    closeCreateModal,
    closeJoinModal: mock.fn(),
    applyRealtimeResult: mock.fn(),
  })

  await handleCreateGame(noopEvent)

  assert.equal(createGameMock.mock.calls.length, 1)
  assert.deepEqual(createGameMock.mock.calls[0].arguments[0], { playerName: 'Casey' })
  assert.equal(appActions.createGameSucceeded.mock.calls.length, 1)
  const payload = appActions.createGameSucceeded.mock.calls[0].arguments[0]
  assert.equal(payload.ownerSession.gameId, 'game-1')
  assert.equal(payload.ownerSession.ownerPlayerId, 'p1')
  assert.equal(payload.selectedMaxCards, '8')
  assert.equal(payload.selectedAiDifficulty, 'hard')
  assert.equal(closeCreateModal.mock.calls.length, 1)

  const stored = JSON.parse(window.localStorage.getItem('setback.gameSessions.v1'))
  assert.equal(stored['game-1'].playerToken, 'owner-token')
  assert.equal(stored['game-1'].role, 'owner')
})

test('handleCreateGame reports a generic failure message when the API rejects', async () => {
  createGameMock.mock.mockImplementation(async () => {
    throw new Error('Rate exceeded')
  })

  const appActions = buildActions()
  const appState = buildAppState({ home: { playerName: 'Casey' } })
  const { handleCreateGame } = useSessionActions({
    appState,
    appActions,
    activeLobbyPlayerId: '',
    closeCreateModal: mock.fn(),
    closeJoinModal: mock.fn(),
    applyRealtimeResult: mock.fn(),
  })

  await handleCreateGame(noopEvent)

  assert.equal(appActions.createGameFailed.mock.calls.length, 1)
  assert.equal(appActions.createGameFailed.mock.calls[0].arguments[0], 'Unable to create game.')
})

test('handleJoinGame validates both the game id and player name', async () => {
  const appActions = buildActions()
  const appState = buildAppState({ home: { joinGameId: '', joinPlayerName: '' } })
  const { handleJoinGame } = useSessionActions({
    appState,
    appActions,
    activeLobbyPlayerId: '',
    closeCreateModal: mock.fn(),
    closeJoinModal: mock.fn(),
    applyRealtimeResult: mock.fn(),
  })

  await handleJoinGame(noopEvent)

  assert.equal(joinGameMock.mock.calls.length, 0)
  assert.deepEqual(appActions.joinGameValidationFailed.mock.calls[0].arguments[0], {
    gameId: 'Game ID is required.',
    playerName: 'Player Name is required.',
  })
})

test('handleJoinGame delegates to handleRejoinGame when a rejoin selection is active', async () => {
  getGameStateMock.mock.mockImplementation(async () => ({ game: { id: 'game-9', phase: { stage: 'Bidding' } }, version: 3 }))
  returnFromAwayMock.mock.mockImplementation(async () => ({ game: { id: 'game-9', phase: { stage: 'Bidding' } }, version: 4 }))

  const appActions = buildActions()
  const appState = buildAppState({
    home: {
      selectedRejoinGameId: 'game-9',
      rejoinableGames: [{ gameId: 'game-9', playerToken: 'player-token', role: 'player', playerName: 'Casey' }],
    },
  })
  const closeJoinModal = mock.fn()
  const { handleJoinGame } = useSessionActions({
    appState,
    appActions,
    activeLobbyPlayerId: '',
    closeCreateModal: mock.fn(),
    closeJoinModal,
    applyRealtimeResult: mock.fn(),
  })

  await handleJoinGame(noopEvent)

  assert.equal(joinGameMock.mock.calls.length, 0)
  assert.equal(appActions.rejoinGameSucceeded.mock.calls.length, 1)
  assert.equal(closeJoinModal.mock.calls.length, 1)
})

test('handleJoinGame succeeds and stores the player session', async () => {
  joinGameMock.mock.mockImplementation(async () => ({
    game: { id: 'game-5', version: 2 },
    playerToken: 'player-token',
    version: 2,
  }))

  const appActions = buildActions()
  const appState = buildAppState({ home: { joinGameId: 'game-5', joinPlayerName: 'Robin' } })
  const closeJoinModal = mock.fn()
  const { handleJoinGame } = useSessionActions({
    appState,
    appActions,
    activeLobbyPlayerId: '',
    closeCreateModal: mock.fn(),
    closeJoinModal,
    applyRealtimeResult: mock.fn(),
  })

  await handleJoinGame(noopEvent)

  assert.equal(joinGameMock.mock.calls.length, 1)
  assert.deepEqual(joinGameMock.mock.calls[0].arguments[0], { gameId: 'game-5', playerName: 'Robin' })
  assert.equal(appActions.joinGameSucceeded.mock.calls.length, 1)
  assert.equal(closeJoinModal.mock.calls.length, 1)
})

test('handleJoinGame reports a generic failure message when the API rejects', async () => {
  joinGameMock.mock.mockImplementation(async () => {
    throw new Error('Game not found')
  })

  const appActions = buildActions()
  const appState = buildAppState({ home: { joinGameId: 'missing', joinPlayerName: 'Robin' } })
  const { handleJoinGame } = useSessionActions({
    appState,
    appActions,
    activeLobbyPlayerId: '',
    closeCreateModal: mock.fn(),
    closeJoinModal: mock.fn(),
    applyRealtimeResult: mock.fn(),
  })

  await handleJoinGame(noopEvent)

  assert.equal(appActions.joinGameFailed.mock.calls[0].arguments[0], 'Unable to join game.')
})

test('handleRenamePlayer is a no-op without an active session', async () => {
  const appActions = buildActions()
  const appState = buildAppState()
  const { handleRenamePlayer } = useSessionActions({
    appState,
    appActions,
    activeLobbyPlayerId: '',
    closeCreateModal: mock.fn(),
    closeJoinModal: mock.fn(),
    applyRealtimeResult: mock.fn(),
  })

  const result = await handleRenamePlayer('New Name', 'p1')

  assert.equal(result, false)
  assert.equal(renamePlayerMock.mock.calls.length, 0)
})

test('handleRenamePlayer applies the realtime result and updates the stored session name for the active player', async () => {
  renamePlayerMock.mock.mockImplementation(async () => ({ game: { id: 'game-1', version: 2 } }))
  window.localStorage.setItem(
    'setback.gameSessions.v1',
    JSON.stringify({ 'game-1': { playerToken: 'owner-token', role: 'owner', playerName: 'Old Name' } }),
  )

  const appActions = buildActions()
  const appState = buildAppState({
    session: { ownerSession: { gameId: 'game-1', playerToken: 'owner-token' } },
  })
  const applyRealtimeResult = mock.fn()
  const { handleRenamePlayer } = useSessionActions({
    appState,
    appActions,
    activeLobbyPlayerId: 'p1',
    closeCreateModal: mock.fn(),
    closeJoinModal: mock.fn(),
    applyRealtimeResult,
  })

  const result = await handleRenamePlayer('New Name', 'p1')

  assert.equal(result, true)
  assert.equal(applyRealtimeResult.mock.calls.length, 1)
  assert.equal(appActions.setIsRenamingPlayer.mock.calls[0].arguments[0], true)
  assert.equal(appActions.setIsRenamingPlayer.mock.calls.at(-1).arguments[0], false)

  const stored = JSON.parse(window.localStorage.getItem('setback.gameSessions.v1'))
  assert.equal(stored['game-1'].playerName, 'New Name')
})

test('handleRenamePlayer does not update the stored session name for a different player', async () => {
  renamePlayerMock.mock.mockImplementation(async () => ({ game: { id: 'game-1', version: 2 } }))
  window.localStorage.setItem(
    'setback.gameSessions.v1',
    JSON.stringify({ 'game-1': { playerToken: 'owner-token', role: 'owner', playerName: 'Old Name' } }),
  )

  const appActions = buildActions()
  const appState = buildAppState({
    session: { ownerSession: { gameId: 'game-1', playerToken: 'owner-token' } },
  })
  const { handleRenamePlayer } = useSessionActions({
    appState,
    appActions,
    activeLobbyPlayerId: 'p1',
    closeCreateModal: mock.fn(),
    closeJoinModal: mock.fn(),
    applyRealtimeResult: mock.fn(),
  })

  await handleRenamePlayer('New Name', 'p2')

  const stored = JSON.parse(window.localStorage.getItem('setback.gameSessions.v1'))
  assert.equal(stored['game-1'].playerName, 'Old Name')
})

test('handleRenamePlayer surfaces a generic error and clears the renaming flag on failure', async () => {
  renamePlayerMock.mock.mockImplementation(async () => {
    throw new Error('Invalid player token')
  })

  const appActions = buildActions()
  const appState = buildAppState({
    session: { ownerSession: { gameId: 'game-1', playerToken: 'owner-token' } },
  })
  const { handleRenamePlayer } = useSessionActions({
    appState,
    appActions,
    activeLobbyPlayerId: 'p1',
    closeCreateModal: mock.fn(),
    closeJoinModal: mock.fn(),
    applyRealtimeResult: mock.fn(),
  })

  const result = await handleRenamePlayer('New Name', 'p1')

  assert.equal(result, false)
  assert.equal(appActions.setGameError.mock.calls[0].arguments[0], 'Unable to update player name.')
  assert.equal(appActions.setIsRenamingPlayer.mock.calls.at(-1).arguments[0], false)
})
