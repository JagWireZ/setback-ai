import test from 'node:test'
import assert from 'node:assert/strict'
import { mock } from 'node:test'

const lambdaClientUrl = new URL('../src/api/lambdaClient.js', import.meta.url).href

const createMemoryStorage = () => {
  const store = new Map()
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  }
}

const withWindow = async (fn) => {
  const previousWindow = globalThis.window
  globalThis.window = {
    localStorage: createMemoryStorage(),
    location: { href: 'http://localhost/' },
    history: { replaceState: () => {} },
  }

  try {
    return await fn(globalThis.window)
  } finally {
    globalThis.window = previousWindow
  }
}

let checkStateMock = mock.fn()
let getGameStateMock = mock.fn()

mock.module(lambdaClientUrl, {
  exports: {
    checkState: (...args) => checkStateMock(...args),
    getGameState: (...args) => getGameStateMock(...args),
  },
})

const {
  clearGameIdInUrl,
  clearStoredGameSession,
  getGameIdFromUrl,
  getStoredGameSession,
  normalizeStoredSessionGame,
  pruneMissingStoredGameSessions,
  saveStoredGameSession,
  setGameIdInUrl,
} = await import('../src/utils/gameSessions.js')

test.beforeEach(() => {
  checkStateMock.mock.resetCalls()
  getGameStateMock.mock.resetCalls()
})

test('saveStoredGameSession is a no-op without a gameId or playerToken, and round-trips otherwise', async () => {
  await withWindow((win) => {
    saveStoredGameSession('', 'token', 'owner')
    saveStoredGameSession('game-1', '', 'owner')
    assert.equal(win.localStorage.getItem('setback.gameSessions.v1'), null)

    saveStoredGameSession('game-1', 'token-1', 'owner', 'Casey')
    const stored = getStoredGameSession('game-1')
    assert.equal(stored.playerToken, 'token-1')
    assert.equal(stored.role, 'owner')
    assert.equal(stored.playerName, 'Casey')
  })
})

test('getStoredGameSession returns null for missing games, blank tokens, or no gameId', async () => {
  await withWindow(() => {
    assert.equal(getStoredGameSession(''), null)
    assert.equal(getStoredGameSession('unknown-game'), null)

    saveStoredGameSession('game-2', '   ', 'player')
    assert.equal(getStoredGameSession('game-2'), null)
  })
})

test('clearStoredGameSession removes only the targeted game', async () => {
  await withWindow(() => {
    saveStoredGameSession('game-1', 'token-1', 'owner')
    saveStoredGameSession('game-2', 'token-2', 'player')

    clearStoredGameSession('game-1')

    assert.equal(getStoredGameSession('game-1'), null)
    assert.ok(getStoredGameSession('game-2'))
  })
})

test('getGameIdFromUrl reads gameid (or legacy gameId) from the query string', async () => {
  await withWindow((win) => {
    win.location.href = 'http://localhost/?gameid=Brave-Otter'
    assert.equal(getGameIdFromUrl(), 'Brave-Otter')

    win.location.href = 'http://localhost/?gameId=Legacy-Case'
    assert.equal(getGameIdFromUrl(), 'Legacy-Case')

    win.location.href = 'http://localhost/'
    assert.equal(getGameIdFromUrl(), '')
  })
})

test('setGameIdInUrl sets gameid and clears the legacy gameId param', async () => {
  await withWindow((win) => {
    win.location.href = 'http://localhost/?gameId=old-value'
    let replacedUrl
    win.history.replaceState = (state, title, url) => {
      replacedUrl = url
    }

    setGameIdInUrl('brave-otter')

    assert.equal(replacedUrl, '/?gameid=brave-otter')
  })
})

test('clearGameIdInUrl removes both gameid params', async () => {
  await withWindow((win) => {
    win.location.href = 'http://localhost/?gameid=brave-otter&gameId=legacy'
    let replacedUrl
    win.history.replaceState = (state, title, url) => {
      replacedUrl = url
    }

    clearGameIdInUrl()

    assert.equal(replacedUrl, '/')
  })
})

test('pruneMissingStoredGameSessions drops sessions with blank tokens without calling the API', async () => {
  await withWindow(async () => {
    saveStoredGameSession('game-1', '   ', 'owner')

    const result = await pruneMissingStoredGameSessions()

    assert.deepEqual(result, {})
    assert.equal(checkStateMock.mock.calls.length, 0)
    assert.equal(getGameStateMock.mock.calls.length, 0)
  })
})

test('pruneMissingStoredGameSessions removes sessions whose game is gone or whose token is invalid', async () => {
  await withWindow(async () => {
    saveStoredGameSession('missing-game', 'token-a', 'player')
    saveStoredGameSession('bad-token-game', 'token-b', 'player')
    saveStoredGameSession('still-alive', 'token-c', 'player')

    getGameStateMock.mock.mockImplementation(async ({ gameId }) => {
      if (gameId === 'missing-game') {
        throw new Error('Game not found')
      }
      if (gameId === 'bad-token-game') {
        throw new Error('Invalid player token')
      }
      return { game: { id: gameId } }
    })

    const result = await pruneMissingStoredGameSessions()

    assert.deepEqual(Object.keys(result), ['still-alive'])
    assert.equal(getStoredGameSession('missing-game'), null)
    assert.equal(getStoredGameSession('bad-token-game'), null)
    assert.ok(getStoredGameSession('still-alive'))
  })
})

test('pruneMissingStoredGameSessions keeps a session when the lookup fails for an unrelated reason', async () => {
  await withWindow(async () => {
    saveStoredGameSession('flaky-game', 'token-d', 'player')

    getGameStateMock.mock.mockImplementation(async () => {
      throw new Error('Rate exceeded')
    })

    const result = await pruneMissingStoredGameSessions()

    assert.ok(result['flaky-game'])
  })
})

test('normalizeStoredSessionGame with preferredRole "player" only tries the player lookup', async () => {
  getGameStateMock.mock.mockImplementation(async () => ({ game: { id: 'g1' }, version: 4 }))

  const result = await normalizeStoredSessionGame('g1', 'token-1', 'player')

  assert.deepEqual(result, { role: 'player', game: { id: 'g1' }, playerToken: 'token-1', version: 4 })
  assert.equal(checkStateMock.mock.calls.length, 0)
})

test('normalizeStoredSessionGame with preferredRole "player" returns null when the lookup throws', async () => {
  getGameStateMock.mock.mockImplementation(async () => {
    throw new Error('Game not found')
  })

  const result = await normalizeStoredSessionGame('g1', 'token-1', 'player')

  assert.equal(result, null)
})

test('normalizeStoredSessionGame with preferredRole "owner" restores the owner session', async () => {
  checkStateMock.mock.mockImplementation(async () => ({
    game: { id: 'g1', players: [{ type: 'ai' }, { type: 'human', id: 'human-1' }] },
  }))

  const result = await normalizeStoredSessionGame('g1', 'owner-token', 'owner')

  assert.deepEqual(result, {
    role: 'owner',
    game: { id: 'g1', players: [{ type: 'ai' }, { type: 'human', id: 'human-1' }] },
    playerToken: 'owner-token',
    ownerPlayerId: 'human-1',
  })
  assert.equal(getGameStateMock.mock.calls.length, 0)
})

test('normalizeStoredSessionGame with preferredRole "owner" returns null on a recognized auth/lookup failure', async () => {
  checkStateMock.mock.mockImplementation(async () => {
    throw new Error('Owner token required')
  })

  const result = await normalizeStoredSessionGame('g1', 'not-owner', 'owner')

  assert.equal(result, null)
})

test('normalizeStoredSessionGame with no preferred role tries owner first, then falls back to player', async () => {
  checkStateMock.mock.mockImplementation(async () => {
    throw new Error('Owner token required')
  })
  getGameStateMock.mock.mockImplementation(async () => ({ game: { id: 'g1' }, version: 1 }))

  const result = await normalizeStoredSessionGame('g1', 'player-token', undefined)

  assert.deepEqual(result, { role: 'player', game: { id: 'g1' }, playerToken: 'player-token', version: 1 })
})

test('normalizeStoredSessionGame with no preferred role returns the owner session when found', async () => {
  checkStateMock.mock.mockImplementation(async () => ({
    game: { id: 'g1', players: [{ type: 'human', id: 'human-1' }] },
  }))

  const result = await normalizeStoredSessionGame('g1', 'owner-token', undefined)

  assert.equal(result.role, 'owner')
  assert.equal(getGameStateMock.mock.calls.length, 0)
})
