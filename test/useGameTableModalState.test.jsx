import test from 'node:test'
import assert from 'node:assert/strict'
import '../test/setupDom.js'
import { renderHook, act, cleanup } from '@testing-library/react'

import { useGameTableModalState } from '../src/hooks/useGameTableModalState.js'

test.afterEach(() => {
  cleanup()
})

const baseProps = {
  bookWinnerMessage: '',
  currentPlayerName: 'Casey',
  gamePlayers: [{ id: 'p1', name: 'Casey' }],
  isGameOver: false,
  isMenuModalOpen: false,
  orderedPlayers: [{ id: 'p1', name: 'Casey' }, { id: 'p2', name: 'Robin' }],
}

test('editedPlayerName tracks currentPlayerName while not editing, and freezes while editing', () => {
  const { result, rerender } = renderHook((props) => useGameTableModalState(props), {
    initialProps: { ...baseProps, isMenuModalOpen: true },
  })

  assert.equal(result.current.editedPlayerName, 'Casey')

  act(() => result.current.setIsEditingPlayerName(true))
  act(() => result.current.setEditedPlayerName('Cas'))

  rerender({ ...baseProps, isMenuModalOpen: true, currentPlayerName: 'Casey Renamed' })
  assert.equal(result.current.editedPlayerName, 'Cas')
})

test('closing the menu modal resets the editing flag and re-syncs the draft name', () => {
  const { result, rerender } = renderHook((props) => useGameTableModalState(props), {
    initialProps: { ...baseProps, isMenuModalOpen: true },
  })

  act(() => result.current.setIsEditingPlayerName(true))
  act(() => result.current.setEditedPlayerName('Draft Name'))

  rerender({ ...baseProps, isMenuModalOpen: false })

  assert.equal(result.current.isEditingPlayerName, false)
  assert.equal(result.current.editedPlayerName, 'Casey')
})

test('selecting a score player resolves from orderedPlayers first, then gamePlayers', () => {
  const { result, rerender } = renderHook((props) => useGameTableModalState(props), {
    initialProps: baseProps,
  })

  act(() => result.current.setSelectedScorePlayerId('p2'))
  assert.equal(result.current.selectedScorePlayer.name, 'Robin')
  assert.equal(result.current.scorePlayerNameDraft, 'Robin')

  rerender({
    ...baseProps,
    orderedPlayers: [],
    gamePlayers: [{ id: 'p2', name: 'Robin Fallback' }],
  })
  assert.equal(result.current.selectedScorePlayer.name, 'Robin Fallback')
})

test('selecting a score player who disappears from the roster clears the selection', () => {
  const { result, rerender } = renderHook((props) => useGameTableModalState(props), {
    initialProps: baseProps,
  })

  act(() => result.current.setSelectedScorePlayerId('p2'))
  assert.ok(result.current.selectedScorePlayer)

  rerender({ ...baseProps, orderedPlayers: [{ id: 'p1', name: 'Casey' }], gamePlayers: [] })

  assert.equal(result.current.selectedScorePlayerId, '')
  assert.equal(result.current.scorePlayerNameDraft, '')
  assert.equal(result.current.selectedScorePlayer, null)
})

test('closeScorePlayerModal clears the selection and draft', () => {
  const { result } = renderHook((props) => useGameTableModalState(props), {
    initialProps: baseProps,
  })

  act(() => result.current.setSelectedScorePlayerId('p2'))
  act(() => result.current.closeScorePlayerModal())

  assert.equal(result.current.selectedScorePlayerId, '')
  assert.equal(result.current.scorePlayerNameDraft, '')
})

test('the score modal auto-opens exactly once when the game ends with no book-winner message', () => {
  const { result, rerender } = renderHook((props) => useGameTableModalState(props), {
    initialProps: baseProps,
  })

  rerender({ ...baseProps, isGameOver: true })
  assert.equal(result.current.isScoreModalOpen, true)

  act(() => result.current.setIsScoreModalOpen(false))
  rerender({ ...baseProps, isGameOver: true, bookWinnerMessage: '' })
  assert.equal(result.current.isScoreModalOpen, false)
})

test('the score modal does not auto-open while a book-winner message is showing', () => {
  const { result, rerender } = renderHook((props) => useGameTableModalState(props), {
    initialProps: baseProps,
  })

  rerender({ ...baseProps, isGameOver: true, bookWinnerMessage: 'Casey won the book!' })

  assert.equal(result.current.isScoreModalOpen, false)
})

test('the auto-open guard resets once the game is no longer over', () => {
  const { result, rerender } = renderHook((props) => useGameTableModalState(props), {
    initialProps: baseProps,
  })

  rerender({ ...baseProps, isGameOver: true })
  act(() => result.current.setIsScoreModalOpen(false))

  rerender({ ...baseProps, isGameOver: false })
  rerender({ ...baseProps, isGameOver: true })

  assert.equal(result.current.isScoreModalOpen, true)
})

test('openRemovePlayerConfirm is a no-op without a player, and closeRemovePlayerConfirm clears it', () => {
  const { result } = renderHook((props) => useGameTableModalState(props), {
    initialProps: baseProps,
  })

  act(() => result.current.openRemovePlayerConfirm(null))
  assert.equal(result.current.pendingRemovePlayer, null)

  act(() => result.current.openRemovePlayerConfirm({ id: 'p2', name: 'Robin' }))
  assert.deepEqual(result.current.pendingRemovePlayer, { id: 'p2', name: 'Robin' })

  act(() => result.current.closeRemovePlayerConfirm())
  assert.equal(result.current.pendingRemovePlayer, null)
})

test('shortenedMenuPlayerName truncates long player names', () => {
  const { result } = renderHook((props) => useGameTableModalState(props), {
    initialProps: { ...baseProps, currentPlayerName: 'A Very Long Player Name Indeed' },
  })

  assert.ok(result.current.shortenedMenuPlayerName.length <= 18)
})
