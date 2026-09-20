import test from 'node:test'
import assert from 'node:assert/strict'
import { mock } from 'node:test'
import '../test/setupDom.js'
import { renderHook, cleanup } from '@testing-library/react'

const lambdaClientUrl = new URL('../src/api/lambdaClient.js', import.meta.url).href

mock.module(lambdaClientUrl, {
  exports: { checkState: async () => ({}), getGameState: async () => ({}) },
})

const { useLobbyDerivedState } = await import('../src/hooks/useLobbyDerivedState.js')

test.afterEach(() => {
  cleanup()
})

const buildGame = (overrides = {}) => ({
  id: 'game-1',
  phase: { stage: 'Bidding', roundIndex: 0 },
  options: { rounds: [{ cardCount: 6, direction: 'down' }] },
  playerOrder: ['p1', 'p2'],
  players: [
    { id: 'p1', name: 'Casey', type: 'human' },
    { id: 'p2', name: 'Robin', type: 'ai' },
  ],
  scores: [],
  ...overrides,
})

test('useLobbyDerivedState is empty when there is no active session', () => {
  const { result } = renderHook(() => useLobbyDerivedState({ ownerSession: null, playerSession: null }))

  assert.equal(result.current.activeGame, undefined)
  assert.equal(result.current.isOwnerLobby, false)
  assert.deepEqual(result.current.orderedPlayers, [])
  assert.equal(result.current.activeLobbyPlayerId, '')
  assert.equal(result.current.shareLink, '')
})

test('useLobbyDerivedState prefers the owner session and orders players by playerOrder', () => {
  const ownerSession = { gameId: 'game-1', playerToken: 'owner-token', ownerPlayerId: 'p1', game: buildGame() }
  const playerSession = { gameId: 'game-2', playerToken: 'player-token', game: buildGame({ id: 'game-2' }) }

  const { result } = renderHook(() => useLobbyDerivedState({ ownerSession, playerSession }))

  assert.equal(result.current.isOwnerLobby, true)
  assert.equal(result.current.activeGame.id, 'game-1')
  assert.deepEqual(
    result.current.orderedPlayers.map((player) => player.id),
    ['p1', 'p2'],
  )
  assert.equal(result.current.activeLobbyPlayerId, 'p1')
  assert.equal(result.current.activeLobbyPlayer.name, 'Casey')
  assert.equal(result.current.activeSessionKey, 'owner:game-1:owner-token')
})

test('useLobbyDerivedState falls back to the player session when there is no owner session', () => {
  const playerSession = { gameId: 'game-2', playerToken: 'player-token', game: buildGame({ id: 'game-2' }) }

  const { result } = renderHook(() => useLobbyDerivedState({ ownerSession: null, playerSession }))

  assert.equal(result.current.isOwnerLobby, false)
  assert.equal(result.current.activeGame.id, 'game-2')
  assert.equal(result.current.activeSessionKey, 'player:game-2:player-token')
})

test('useLobbyDerivedState marks a disconnected human player session as away for a non-owner viewer', () => {
  const game = buildGame({
    players: [
      { id: 'p1', name: 'Casey', type: 'human', connected: false },
      { id: 'p2', name: 'Robin', type: 'ai' },
    ],
    phase: { stage: 'Playing', roundIndex: 0, cards: { hands: [{ playerId: 'p1', cards: [] }] } },
  })
  const playerSession = { gameId: 'game-1', playerToken: 'player-token', game }

  const { result } = renderHook(() => useLobbyDerivedState({ ownerSession: null, playerSession }))

  assert.equal(result.current.activeLobbyPlayerId, 'p1')
  assert.equal(result.current.isLocalPlayerMarkedAway, true)
})

test('useLobbyDerivedState treats card counts of 1-3 as trip rounds', () => {
  const tripGame = buildGame({ options: { rounds: [{ cardCount: 3, direction: 'down' }] } })
  const ownerSession = { gameId: 'game-1', playerToken: 'owner-token', game: tripGame }

  const { result } = renderHook(() => useLobbyDerivedState({ ownerSession, playerSession: null }))

  assert.equal(result.current.isTripRound, true)
  assert.equal(result.current.currentRoundCardCount, 3)
})
