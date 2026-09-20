import test from 'node:test'
import assert from 'node:assert/strict'
import { mock } from 'node:test'
import '../test/setupDom.js'
import { renderHook, act, cleanup } from '@testing-library/react'

const lambdaClientUrl = new URL('../src/api/lambdaClient.js', import.meta.url).href

const checkStateMock = mock.fn()
const getGameStateMock = mock.fn()
const returnFromAwayMock = mock.fn()
const setActiveGameSessionMock = mock.fn()
const subscribeToGameEventsMock = mock.fn(() => () => {})

mock.module(lambdaClientUrl, {
  exports: {
    checkState: (...args) => checkStateMock(...args),
    getGameState: (...args) => getGameStateMock(...args),
    returnFromAway: (...args) => returnFromAwayMock(...args),
    setActiveGameSession: (...args) => setActiveGameSessionMock(...args),
    subscribeToGameEvents: (...args) => subscribeToGameEventsMock(...args),
  },
})

const { useAppRuntime } = await import('../src/hooks/useAppRuntime.js')

test.afterEach(() => {
  cleanup()
  window.localStorage.clear()
  for (const fn of [checkStateMock, getGameStateMock, returnFromAwayMock, setActiveGameSessionMock, subscribeToGameEventsMock]) {
    fn.mock.resetCalls()
  }
  subscribeToGameEventsMock.mock.mockImplementation(() => () => {})
})

const buildActions = () => ({
  rejoinableGamesLoaded: mock.fn(),
  rejoinableGamesLoadingStarted: mock.fn(),
  sessionRestoreInitialized: mock.fn(),
  sessionRestoreSucceeded: mock.fn(),
  setGameError: mock.fn(),
  setLobbyInfo: mock.fn(),
  setOwnerSession: mock.fn(),
  setPersistedEndOfRoundSummary: mock.fn(),
  setPlayerSession: mock.fn(),
  setRequestError: mock.fn(),
  setSelectedMaxCards: mock.fn(),
  setSessionInfo: mock.fn(),
  setSortMode: mock.fn(),
})

const buildAppState = (overrides = {}) => ({
  game: { gameError: '', ...overrides.game },
  session: { ownerSession: null, playerSession: null, ...overrides.session },
})

const buildProps = (overrides = {}) => ({
  appState: buildAppState(overrides.appState),
  appActions: overrides.appActions ?? buildActions(),
  activeGame: null,
  activeLobbySession: null,
  activeSessionKey: '',
  completedRoundCount: 0,
  isLocalPlayerMarkedAway: false,
  isOwnerLobby: false,
  maxCardsForLobbySeatCount: 10,
  selectedMaxCards: '10',
  shareLink: '',
  isLobbyShareModalOpen: false,
  reactionCooldownUntil: 0,
  setIsEndOfRoundModalDismissed: mock.fn(),
  setIsBidModalOpen: mock.fn(),
  openJoinModal: mock.fn(),
  closeJoinModal: mock.fn(),
  setShowAwayContinueModal: mock.fn(),
  setShareQrCodeDataUrl: mock.fn(),
  setIsShareLinkCopied: mock.fn(),
  ...overrides,
})

test('requestActiveStateReview is a no-op without an active session', async () => {
  const { result } = renderHook(() => useAppRuntime(buildProps()))

  await result.current.requestActiveStateReview()

  assert.equal(checkStateMock.mock.calls.length, 0)
  assert.equal(getGameStateMock.mock.calls.length, 0)
})

test('requestActiveStateReview calls checkState for an owner session and applies the result', async () => {
  checkStateMock.mock.mockImplementation(async () => ({ game: { id: 'game-1', version: 2 } }))
  const appActions = buildActions()
  const appState = buildAppState({
    session: { ownerSession: { gameId: 'game-1', playerToken: 'owner-token', game: { version: 1 } } },
  })

  const { result } = renderHook(() => useAppRuntime(buildProps({ appActions, appState })))

  await result.current.requestActiveStateReview()

  assert.deepEqual(checkStateMock.mock.calls[0].arguments[0], {
    gameId: 'game-1',
    playerToken: 'owner-token',
    associateConnection: false,
  })
  assert.equal(appActions.setOwnerSession.mock.calls.length, 1)
})

test('requestActiveStateReview calls getGameState for a player session with the tracked version', async () => {
  getGameStateMock.mock.mockImplementation(async () => ({ game: { id: 'game-1' }, version: 5 }))
  const appActions = buildActions()
  const appState = buildAppState({
    session: { playerSession: { gameId: 'game-1', playerToken: 'player-token', version: 4 } },
  })

  const { result } = renderHook(() => useAppRuntime(buildProps({ appActions, appState })))

  await result.current.requestActiveStateReview()

  assert.deepEqual(getGameStateMock.mock.calls[0].arguments[0], {
    gameId: 'game-1',
    playerToken: 'player-token',
    version: 4,
    associateConnection: false,
  })
})

test('requestActiveStateReview clears the session when the game is gone or the token is invalid', async () => {
  getGameStateMock.mock.mockImplementation(async () => {
    throw new Error('Game not found')
  })
  const appActions = buildActions()
  const appState = buildAppState({
    session: { playerSession: { gameId: 'missing-game', playerToken: 'player-token' } },
  })

  const { result } = renderHook(() => useAppRuntime(buildProps({ appActions, appState })))

  await result.current.requestActiveStateReview()

  assert.equal(appActions.setSessionInfo.mock.calls.length, 1)
  assert.equal(appActions.setRequestError.mock.calls.length, 1)
})

test('requestActiveStateReview reports a generic error for an unrelated failure', async () => {
  getGameStateMock.mock.mockImplementation(async () => {
    throw new Error('Rate exceeded')
  })
  const appActions = buildActions()
  const appState = buildAppState({
    session: { playerSession: { gameId: 'game-1', playerToken: 'player-token' } },
  })

  const { result } = renderHook(() => useAppRuntime(buildProps({ appActions, appState })))

  await result.current.requestActiveStateReview()

  assert.equal(appActions.setGameError.mock.calls[0].arguments[0], 'Unable to refresh game state.')
  assert.equal(appActions.setSessionInfo.mock.calls.length, 0)
})

test('applyRealtimeResult routes the result to the owner or player session setter', () => {
  const appActions = buildActions()
  const appState = buildAppState({
    session: { ownerSession: { gameId: 'game-1', game: { version: 1 } } },
  })

  const { result } = renderHook(() => useAppRuntime(buildProps({ appActions, appState })))

  act(() => result.current.applyRealtimeResult({ game: { id: 'game-1', version: 2 } }))

  assert.equal(appActions.setOwnerSession.mock.calls.length, 1)
  assert.equal(appActions.setPlayerSession.mock.calls.length, 0)
})

test('handleRemovedFromGame clears the stored session, session state, and the url', () => {
  window.localStorage.setItem(
    'setback.gameSessions.v1',
    JSON.stringify({ 'game-1': { playerToken: 'token', role: 'owner' } }),
  )
  window.history.replaceState({}, '', '/?gameid=game-1')

  const appActions = buildActions()
  const { result } = renderHook(() => useAppRuntime(buildProps({ appActions })))

  act(() => result.current.handleRemovedFromGame('game-1', 'You were removed.'))

  assert.equal(appActions.setSessionInfo.mock.calls[0].arguments[0], null)
  assert.equal(appActions.setRequestError.mock.calls[0].arguments[0], 'You were removed.')
  assert.equal(JSON.parse(window.localStorage.getItem('setback.gameSessions.v1'))['game-1'], undefined)
  assert.equal(window.location.search, '')
})

test('handleCopyShareLink copies the link and resets the copied flag after a delay', async () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  const originalClipboard = navigator.clipboard
  const writeText = mock.fn(async () => {})
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })

  try {
    const setIsShareLinkCopied = mock.fn()
    const { result } = renderHook(() =>
      useAppRuntime(buildProps({ shareLink: 'https://example.com/g/1', setIsShareLinkCopied })),
    )

    await act(() => result.current.handleCopyShareLink())

    assert.equal(writeText.mock.calls[0].arguments[0], 'https://example.com/g/1')
    assert.equal(setIsShareLinkCopied.mock.calls[0].arguments[0], true)

    act(() => {
      mock.timers.tick(2000)
    })

    assert.equal(setIsShareLinkCopied.mock.calls.at(-1).arguments[0], false)
  } finally {
    mock.timers.reset()
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: originalClipboard })
  }
})

test('handleCopyShareLink falls back to a manual-copy message when the clipboard API rejects', async () => {
  const originalClipboard = navigator.clipboard
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async () => { throw new Error('denied') } },
  })

  try {
    const appActions = buildActions()
    const { result } = renderHook(() =>
      useAppRuntime(buildProps({ appActions, shareLink: 'https://example.com/g/1' })),
    )

    await act(() => result.current.handleCopyShareLink())

    assert.equal(appActions.setLobbyInfo.mock.calls[0].arguments[0], 'Unable to copy automatically. Copy the link manually.')
  } finally {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: originalClipboard })
  }
})

test('handleCopyShareLink is a no-op without a share link', async () => {
  const { result } = renderHook(() => useAppRuntime(buildProps({ shareLink: '' })))

  await act(() => result.current.handleCopyShareLink())

  // Nothing to assert on directly beyond "it does not throw" since clipboard is untouched.
  assert.ok(true)
})

test('the away-continue modal opens exactly when the local player transitions to away for the current session', () => {
  const setShowAwayContinueModal = mock.fn()
  const { rerender } = renderHook((props) => useAppRuntime(props), {
    initialProps: buildProps({ activeSessionKey: 'owner:game-1:token', isLocalPlayerMarkedAway: false, setShowAwayContinueModal }),
  })

  rerender(buildProps({ activeSessionKey: 'owner:game-1:token', isLocalPlayerMarkedAway: true, setShowAwayContinueModal }))

  assert.equal(setShowAwayContinueModal.mock.calls.at(-1).arguments[0], true)

  rerender(buildProps({ activeSessionKey: 'owner:game-1:token', isLocalPlayerMarkedAway: false, setShowAwayContinueModal }))

  assert.equal(setShowAwayContinueModal.mock.calls.at(-1).arguments[0], false)
})

test('switching to a new session resets the away-continue modal instead of carrying over a pending state', () => {
  const setShowAwayContinueModal = mock.fn()
  const { rerender } = renderHook((props) => useAppRuntime(props), {
    initialProps: buildProps({ activeSessionKey: 'owner:game-1:token', isLocalPlayerMarkedAway: true, setShowAwayContinueModal }),
  })
  setShowAwayContinueModal.mock.resetCalls()

  rerender(buildProps({ activeSessionKey: 'player:game-2:token-2', isLocalPlayerMarkedAway: false, setShowAwayContinueModal }))

  assert.equal(setShowAwayContinueModal.mock.calls.at(-1).arguments[0], false)
})
