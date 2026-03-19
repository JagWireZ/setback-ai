import test from 'node:test'
import assert from 'node:assert/strict'

import {
  applyResultToSessionRole,
  buildOwnerSession,
  buildPlayerSession,
  clearActiveSessionState,
  clearTimeoutRef,
  clearTimeoutRefs,
  getActiveSession,
  getActiveSessionContext,
  getActiveSessionRole,
  getRestoredPlayerName,
  isConcurrentUpdateError,
  mergeOwnerSessionResult,
  mergePlayerSessionResult,
  resetRealtimeTrackingState,
  setSessionForRole,
} from '../src/utils/sessionState.js'

test('getActiveSession helpers prefer owner session over player session', () => {
  const ownerSession = { gameId: 'game-1', playerToken: 'owner-token' }
  const playerSession = { gameId: 'game-1', playerToken: 'player-token' }

  assert.equal(getActiveSession({ ownerSession, playerSession }), ownerSession)
  assert.equal(getActiveSessionRole({ ownerSession, playerSession }), 'owner')
  assert.deepEqual(getActiveSessionContext({ ownerSession, playerSession }), {
    role: 'owner',
    session: ownerSession,
  })
})

test('getActiveSession helpers fall back to player session and null state', () => {
  const playerSession = { gameId: 'game-2', playerToken: 'player-token' }

  assert.equal(getActiveSession({ ownerSession: null, playerSession }), playerSession)
  assert.equal(getActiveSessionRole({ ownerSession: null, playerSession }), 'player')
  assert.deepEqual(getActiveSessionContext({ ownerSession: null, playerSession }), {
    role: 'player',
    session: playerSession,
  })
  assert.deepEqual(getActiveSessionContext({ ownerSession: null, playerSession: null }), {
    role: null,
    session: null,
  })
})

test('getRestoredPlayerName uses fallback, owner id, and viewer hand lookup', () => {
  const game = {
    players: [
      { id: 'owner-1', name: 'Owner' },
      { id: 'viewer-1', name: 'Viewer' },
    ],
  }

  assert.equal(
    getRestoredPlayerName({ role: 'owner', ownerPlayerId: 'owner-1', game }, 'Stored Name', () => null),
    'Stored Name',
  )
  assert.equal(
    getRestoredPlayerName({ role: 'owner', ownerPlayerId: 'owner-1', game }, '', () => null),
    'Owner',
  )
  assert.equal(
    getRestoredPlayerName({ role: 'player', game }, '', () => ({ playerId: 'viewer-1' })),
    'Viewer',
  )
  assert.equal(getRestoredPlayerName(null, '', () => null), '')
})

test('isConcurrentUpdateError detects transaction conflict messages', () => {
  assert.equal(isConcurrentUpdateError(new Error('TransactionConflict: retry')), true)
  assert.equal(isConcurrentUpdateError('Transaction cancelled by DynamoDB'), true)
  assert.equal(isConcurrentUpdateError(new Error('Different failure')), false)
})

test('mergeOwnerSessionResult keeps newer owner session versions only', () => {
  const previousSession = {
    game: {
      version: 5,
      id: 'game-1',
    },
  }
  const staleResult = {
    version: 4,
    game: {
      version: 4,
      id: 'game-1',
    },
  }
  const freshResult = {
    version: 6,
    game: {
      version: 6,
      id: 'game-1',
      phase: { stage: 'Lobby' },
    },
  }

  assert.equal(mergeOwnerSessionResult(previousSession, staleResult), previousSession)
  assert.deepEqual(mergeOwnerSessionResult(previousSession, freshResult), {
    ...previousSession,
    game: freshResult.game,
  })
})

test('mergePlayerSessionResult keeps newer player session versions only', () => {
  const previousSession = {
    version: 3,
    game: {
      version: 3,
      id: 'game-1',
    },
  }
  const staleResult = {
    version: 2,
    game: {
      version: 2,
      id: 'game-1',
    },
  }
  const freshResult = {
    version: 4,
    game: {
      version: 4,
      id: 'game-1',
      phase: { stage: 'Playing' },
    },
  }

  assert.equal(mergePlayerSessionResult(previousSession, staleResult), previousSession)
  assert.deepEqual(mergePlayerSessionResult(previousSession, freshResult), {
    ...previousSession,
    game: freshResult.game,
    version: 4,
  })
})

test('build session helpers create stable owner and player session shapes', () => {
  assert.deepEqual(
    buildOwnerSession({
      gameId: 'game-1',
      playerToken: 'owner-token',
      game: { id: 'game-1' },
      ownerPlayerId: 'owner-1',
    }),
    {
      gameId: 'game-1',
      playerToken: 'owner-token',
      game: { id: 'game-1' },
      ownerPlayerId: 'owner-1',
    },
  )

  assert.deepEqual(
    buildPlayerSession({
      gameId: 'game-1',
      playerToken: 'player-token',
      game: { id: 'game-1' },
      version: 8,
    }),
    {
      gameId: 'game-1',
      playerToken: 'player-token',
      game: { id: 'game-1' },
      version: 8,
    },
  )
})

test('setSessionForRole routes owner and player sessions to the correct setters', () => {
  const calls = []
  const setOwnerSession = (value) => calls.push(['owner', value])
  const setPlayerSession = (value) => calls.push(['player', value])
  const ownerSession = { gameId: 'game-1' }
  const playerSession = { gameId: 'game-2' }

  setSessionForRole({
    role: 'owner',
    session: ownerSession,
    setOwnerSession,
    setPlayerSession,
  })
  setSessionForRole({
    role: 'player',
    session: playerSession,
    setOwnerSession,
    setPlayerSession,
  })

  assert.deepEqual(calls, [
    ['owner', ownerSession],
    ['player', null],
    ['player', playerSession],
    ['owner', null],
  ])
})

test('applyResultToSessionRole updates only the targeted session setter', () => {
  let ownerUpdater = null
  let playerUpdater = null
  const result = {
    version: 2,
    game: {
      version: 2,
      id: 'game-1',
    },
  }

  applyResultToSessionRole({
    role: 'owner',
    result,
    setOwnerSession: (updater) => {
      ownerUpdater = updater
    },
    setPlayerSession: (updater) => {
      playerUpdater = updater
    },
  })

  const mergedOwner = ownerUpdater({
    game: {
      version: 1,
      id: 'game-1',
    },
  })

  assert.deepEqual(mergedOwner, {
    game: result.game,
  })
  assert.equal(playerUpdater, null)
})

test('clearTimeoutRef and clearTimeoutRefs null out timer refs', () => {
  const cleared = []
  const originalClearTimeout = global.clearTimeout
  global.clearTimeout = (handle) => {
    cleared.push(handle)
  }

  try {
    const firstRef = { current: 'timeout-1' }
    const secondRef = { current: 'timeout-2' }

    clearTimeoutRef(firstRef)
    clearTimeoutRefs([secondRef, { current: null }])

    assert.deepEqual(cleared, ['timeout-1', 'timeout-2'])
    assert.equal(firstRef.current, null)
    assert.equal(secondRef.current, null)
  } finally {
    global.clearTimeout = originalClearTimeout
  }
})

test('resetRealtimeTrackingState resets all realtime refs', () => {
  const refs = {
    aiPauseUntilRef: { current: 42 },
    previousCompletedTrickCountRef: { current: 3 },
    latestShownRoundIndexRef: { current: 7 },
    hydratedRoundSummaryGameIdRef: { current: 'game-1' },
  }

  resetRealtimeTrackingState(refs)

  assert.deepEqual(refs, {
    aiPauseUntilRef: { current: 0 },
    previousCompletedTrickCountRef: { current: 0 },
    latestShownRoundIndexRef: { current: -1 },
    hydratedRoundSummaryGameIdRef: { current: '' },
  })
})

test('clearActiveSessionState clears timers, resets refs, and clears session UI state', () => {
  const timeoutRefs = [
    { current: 'timeout-a' },
    { current: 'timeout-b' },
  ]
  const trackingRefs = {
    aiPauseUntilRef: { current: 100 },
    previousCompletedTrickCountRef: { current: 2 },
    latestShownRoundIndexRef: { current: 4 },
    hydratedRoundSummaryGameIdRef: { current: 'game-7' },
  }
  const stateCalls = []
  const originalClearTimeout = global.clearTimeout
  global.clearTimeout = () => {}

  try {
    clearActiveSessionState({
      timeoutRefs,
      trackingRefs,
      setOwnerSession: (value) => stateCalls.push(['owner', value]),
      setPlayerSession: (value) => stateCalls.push(['player', value]),
      setGameError: (value) => stateCalls.push(['gameError', value]),
      setLobbyInfo: (value) => stateCalls.push(['lobbyInfo', value]),
      setPersistedEndOfRoundSummary: (value) => stateCalls.push(['summary', value]),
      setIsEndOfRoundModalDismissed: (value) => stateCalls.push(['dismissed', value]),
      setIsBidModalOpen: (value) => stateCalls.push(['bidOpen', value]),
    })
  } finally {
    global.clearTimeout = originalClearTimeout
  }

  assert.deepEqual(timeoutRefs, [{ current: null }, { current: null }])
  assert.deepEqual(trackingRefs, {
    aiPauseUntilRef: { current: 0 },
    previousCompletedTrickCountRef: { current: 0 },
    latestShownRoundIndexRef: { current: -1 },
    hydratedRoundSummaryGameIdRef: { current: '' },
  })
  assert.deepEqual(stateCalls, [
    ['owner', null],
    ['player', null],
    ['gameError', ''],
    ['lobbyInfo', ''],
    ['summary', null],
    ['dismissed', false],
    ['bidOpen', false],
  ])
})
