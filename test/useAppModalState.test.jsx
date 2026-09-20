import test from 'node:test'
import assert from 'node:assert/strict'
import '../test/setupDom.js'
import { renderHook, act, cleanup } from '@testing-library/react'

import { useAppModalState } from '../src/hooks/useAppModalState.js'

test.afterEach(() => {
  cleanup()
})

const flushTimers = () => act(() => new Promise((resolve) => setTimeout(resolve, 10)))

test('home session modal opens create/join exclusively and closes back to null', () => {
  const { result } = renderHook(() => useAppModalState())

  act(() => result.current.homeSession.openCreate())
  assert.equal(result.current.homeSession.isCreateOpen, true)
  assert.equal(result.current.homeSession.isJoinOpen, false)

  act(() => result.current.homeSession.openJoin())
  assert.equal(result.current.homeSession.isCreateOpen, false)
  assert.equal(result.current.homeSession.isJoinOpen, true)

  act(() => result.current.homeSession.closeJoin())
  assert.equal(result.current.homeSession.active, null)
})

test('closeCreateModal only clears the active modal if it is currently "create"', () => {
  const { result } = renderHook(() => useAppModalState())

  act(() => result.current.homeSession.openJoin())
  act(() => result.current.homeSession.closeCreate())

  assert.equal(result.current.homeSession.isJoinOpen, true)
})

test('closeSubmitBidModal closes the modal and resets the selected bid', () => {
  const { result } = renderHook(() => useAppModalState())

  act(() => {
    result.current.bid.setIsOpen(true)
    result.current.bid.setSelectedBid('4')
  })
  assert.equal(result.current.bid.isOpen, true)
  assert.equal(result.current.bid.selectedBid, '4')

  act(() => result.current.bid.close())

  assert.equal(result.current.bid.isOpen, false)
  assert.equal(result.current.bid.selectedBid, '0')
})

test('openLobbyRemovePlayerConfirm schedules the pending player after a tick', async () => {
  const { result } = renderHook(() => useAppModalState())

  act(() => result.current.lobbyPlayer.openRemovePlayerConfirm({ id: 'p1', name: 'Casey' }))
  assert.equal(result.current.lobbyPlayer.pendingRemovePlayer, null)

  await flushTimers()

  assert.deepEqual(result.current.lobbyPlayer.pendingRemovePlayer, { id: 'p1', name: 'Casey' })
  assert.equal(result.current.lobbyPlayer.pendingRemoveSeat, null)
})

test('openLobbyRemovePlayerConfirm is a no-op without a player', async () => {
  const { result } = renderHook(() => useAppModalState())

  act(() => result.current.lobbyPlayer.openRemovePlayerConfirm(null))
  await flushTimers()

  assert.equal(result.current.lobbyPlayer.pendingRemovePlayer, null)
})

test('closeRemovePlayerConfirm clears a pending remove-player modal but not other modal types', async () => {
  const { result } = renderHook(() => useAppModalState())

  act(() => result.current.lobbyPlayer.openRemoveSeatConfirm({ id: 'p1', name: 'Casey' }))
  await flushTimers()
  assert.ok(result.current.lobbyPlayer.pendingRemoveSeat)

  act(() => result.current.lobbyPlayer.closeRemovePlayerConfirm())

  assert.ok(result.current.lobbyPlayer.pendingRemoveSeat)
})

test('openLobbyRenamePlayerModal seeds the rename draft with the player name and setRenameDraft updates it', async () => {
  const { result } = renderHook(() => useAppModalState())

  act(() => result.current.lobbyPlayer.openRenameModal({ id: 'p1', name: 'Casey' }))
  await flushTimers()

  assert.equal(result.current.lobbyPlayer.pendingRenamePlayer.name, 'Casey')
  assert.equal(result.current.lobbyPlayer.renameDraft, 'Casey')

  act(() => result.current.lobbyPlayer.setRenameDraft('Cas'))
  assert.equal(result.current.lobbyPlayer.renameDraft, 'Cas')

  act(() => result.current.lobbyPlayer.closeRenameModal())
  assert.equal(result.current.lobbyPlayer.pendingRenamePlayer, null)
  assert.equal(result.current.lobbyPlayer.renameDraft, '')
})

test('setRenameDraft is a no-op when the rename modal is not the active lobby modal', () => {
  const { result } = renderHook(() => useAppModalState())

  act(() => result.current.lobbyPlayer.setRenameDraft('ignored'))

  assert.equal(result.current.lobbyPlayer.renameDraft, '')
})

test('re-triggering the same lobby action resets the pending timer instead of stacking', async () => {
  const { result } = renderHook(() => useAppModalState())

  act(() => result.current.lobbyPlayer.openRenameModal({ id: 'p1', name: 'Casey' }))
  act(() => result.current.lobbyPlayer.openRenameModal({ id: 'p2', name: 'Robin' }))
  await flushTimers()

  assert.equal(result.current.lobbyPlayer.pendingRenamePlayer.id, 'p2')
})
