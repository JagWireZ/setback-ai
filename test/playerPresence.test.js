import test from 'node:test'
import assert from 'node:assert/strict'

import { getPlayerController, getPlayerPresence } from '../src/utils/playerPresence.js'

test('getPlayerPresence prefers the nested presence object when available', () => {
  const player = {
    connected: false,
    lastActiveAt: 111,
    presence: { connected: true, lastSeenAt: 222, away: false },
  }

  assert.deepEqual(getPlayerPresence(player), {
    connected: true,
    lastSeenAt: 222,
    away: false,
  })
})

test('getPlayerPresence falls back to legacy top-level fields', () => {
  const player = { connected: false, lastActiveAt: 999 }

  assert.deepEqual(getPlayerPresence(player), {
    connected: false,
    lastSeenAt: 999,
    away: true,
  })
})

test('getPlayerPresence defaults safely for a missing player', () => {
  assert.deepEqual(getPlayerPresence(undefined), {
    connected: false,
    lastSeenAt: undefined,
    away: false,
  })
})

test('getPlayerController defaults to human when unset', () => {
  assert.equal(getPlayerController(undefined), 'human')
  assert.equal(getPlayerController({}), 'human')
  assert.equal(getPlayerController({ controller: 'ai-temporary' }), 'ai-temporary')
})
