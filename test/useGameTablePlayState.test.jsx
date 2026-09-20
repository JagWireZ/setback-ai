import test from 'node:test'
import assert from 'node:assert/strict'
import { mock } from 'node:test'
import '../test/setupDom.js'
import { renderHook, act, cleanup } from '@testing-library/react'

import { useGameTablePlayState } from '../src/hooks/useGameTablePlayState.js'

test.afterEach(() => {
  cleanup()
})

const buildGame = (overrides = {}) => ({
  id: 'game-1',
  version: 1,
  phase: {
    stage: 'Playing',
    trickIndex: 0,
    turnPlayerId: 'p1',
    cards: { trumpBroken: false, currentTrick: null, completedTricks: [] },
  },
  players: [
    { id: 'p1', name: 'Casey' },
    { id: 'p2', name: 'Robin' },
  ],
  playerOrder: ['p1', 'p2'],
  ...overrides,
})

const buildProps = (overrides = {}) => ({
  actualTurnPlayerId: 'p1',
  completedTricks: [],
  currentTrick: null,
  game: buildGame(),
  isMobileViewport: false,
  mobileActionBarHeight: 0,
  orderedPlayers: [
    { id: 'p1', name: 'Casey' },
    { id: 'p2', name: 'Robin' },
  ],
  viewerHand: { playerId: 'p1', cards: [{ rank: 'A', suit: 'Hearts' }, { rank: 'K', suit: 'Hearts' }] },
  viewerPlayerId: 'p1',
  viewportWidth: 1024,
  ...overrides,
})

test('canSelectCards is true only for the viewer\'s own turn during Playing with no trick-winner reveal', () => {
  const { result } = renderHook(() => useGameTablePlayState(buildProps()))
  assert.equal(result.current.isViewerActualTurn, true)
  assert.equal(result.current.canSelectCards, true)

  const { result: notMyTurn } = renderHook(() => useGameTablePlayState(buildProps({ actualTurnPlayerId: 'p2' })))
  assert.equal(notMyTurn.current.isViewerActualTurn, false)
  assert.equal(notMyTurn.current.canSelectCards, false)

  const biddingGame = buildGame({ phase: { stage: 'Bidding', turnPlayerId: 'p1' } })
  const { result: notPlaying } = renderHook(() => useGameTablePlayState(buildProps({ game: biddingGame })))
  assert.equal(notPlaying.current.canSelectCards, false)
})

test('selecting a card is cleared when it becomes the viewer\'s turn no longer, or the card leaves the hand', () => {
  const { result, rerender } = renderHook((props) => useGameTablePlayState(props), {
    initialProps: buildProps(),
  })

  act(() => result.current.setSelectedCardIndex(1))
  assert.equal(result.current.selectedCardIndex, 1)

  rerender(buildProps({ actualTurnPlayerId: 'p2' }))
  assert.equal(result.current.selectedCardIndex, null)
})

test('selecting a card is cleared when the hand shrinks past the selected index', () => {
  const { result, rerender } = renderHook((props) => useGameTablePlayState(props), {
    initialProps: buildProps(),
  })

  act(() => result.current.setSelectedCardIndex(1))
  rerender(buildProps({ viewerHand: { playerId: 'p1', cards: [{ rank: 'A', suit: 'Hearts' }] } }))

  assert.equal(result.current.selectedCardIndex, null)
})

test('displayedTurnPlayerId tracks the actual turn player and resets when the game id changes', () => {
  const { result, rerender } = renderHook((props) => useGameTablePlayState(props), {
    initialProps: buildProps({ actualTurnPlayerId: 'p1' }),
  })

  assert.equal(result.current.displayedTurnPlayerId, 'p1')

  rerender(buildProps({ actualTurnPlayerId: 'p2' }))
  assert.equal(result.current.displayedTurnPlayerId, 'p2')
})

test('handleSelectTrickCard toggles the selected trick card and is a no-op during the book-winner reveal', () => {
  const currentTrick = {
    leadPlayerId: 'p1',
    plays: [
      { playerId: 'p1', card: { rank: 'A', suit: 'Hearts' } },
      { playerId: 'p2', card: { rank: 'K', suit: 'Hearts' } },
    ],
  }
  const { result } = renderHook(() => useGameTablePlayState(buildProps({ currentTrick })))

  act(() => result.current.handleSelectTrickCard(0))
  assert.equal(result.current.selectedTrickCardIndex, 0)

  act(() => result.current.handleSelectTrickCard(0))
  assert.equal(result.current.selectedTrickCardIndex, null)
})

test('a new completed trick with a winner reveals the trick and shows a book-winner message', () => {
  const completedTrick = {
    leadPlayerId: 'p1',
    winnerPlayerId: 'p2',
    plays: [
      { playerId: 'p1', card: { rank: 'A', suit: 'Hearts' } },
      { playerId: 'p2', card: { rank: 'K', suit: 'Hearts' } },
    ],
  }

  const { result, rerender } = renderHook((props) => useGameTablePlayState(props), {
    initialProps: buildProps({ completedTricks: [] }),
  })

  rerender(buildProps({ completedTricks: [completedTrick] }))

  assert.equal(result.current.bookWinnerMessage, 'Robin won the book.')
  assert.equal(result.current.isTrickWinnerRevealVisible, true)
  assert.deepEqual(result.current.displayedTrickPlays, completedTrick.plays)
})

test('the book-winner reveal announces "You won the book!" for the viewer\'s own win and clears after the delay', () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    const completedTrick = {
      leadPlayerId: 'p1',
      winnerPlayerId: 'p1',
      plays: [
        { playerId: 'p1', card: { rank: 'A', suit: 'Hearts' } },
        { playerId: 'p2', card: { rank: 'K', suit: 'Hearts' } },
      ],
    }

    const { result, rerender } = renderHook((props) => useGameTablePlayState(props), {
      initialProps: buildProps({ completedTricks: [] }),
    })

    rerender(buildProps({ completedTricks: [completedTrick] }))
    assert.equal(result.current.bookWinnerMessage, 'You won the book!')

    act(() => {
      mock.timers.tick(5000)
    })

    assert.equal(result.current.bookWinnerMessage, '')
    assert.equal(result.current.isTrickWinnerRevealVisible, false)
  } finally {
    mock.timers.reset()
  }
})

test('changing the game id resets any in-progress book-winner reveal', () => {
  const completedTrick = {
    leadPlayerId: 'p1',
    winnerPlayerId: 'p2',
    plays: [
      { playerId: 'p1', card: { rank: 'A', suit: 'Hearts' } },
      { playerId: 'p2', card: { rank: 'K', suit: 'Hearts' } },
    ],
  }

  const { result, rerender } = renderHook((props) => useGameTablePlayState(props), {
    initialProps: buildProps({ completedTricks: [] }),
  })

  rerender(buildProps({ completedTricks: [completedTrick] }))
  assert.ok(result.current.bookWinnerMessage)

  rerender(buildProps({ game: buildGame({ id: 'game-2' }), completedTricks: [] }))

  assert.equal(result.current.bookWinnerMessage, '')
  assert.equal(result.current.isTrickWinnerRevealVisible, false)
})

test('trump breaking for the first time queues a floating celebration that clears itself after a delay', () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    const notBrokenGame = buildGame({
      phase: { stage: 'Playing', trickIndex: 0, turnPlayerId: 'p1', cards: { trumpBroken: false, currentTrick: null, completedTricks: [] } },
    })
    const { result, rerender } = renderHook((props) => useGameTablePlayState(props), {
      initialProps: buildProps({ game: notBrokenGame }),
    })
    assert.equal(result.current.floatingCelebrations.length, 0)

    const brokenGame = buildGame({
      phase: { stage: 'Playing', trickIndex: 0, turnPlayerId: 'p1', cards: { trumpBroken: true, currentTrick: null, completedTricks: [] } },
    })
    rerender(buildProps({ game: brokenGame }))

    assert.equal(result.current.floatingCelebrations.length, 1)
    assert.equal(result.current.floatingCelebrations[0].message, 'Trump has been broken!')

    act(() => {
      mock.timers.tick(7000)
    })

    assert.equal(result.current.floatingCelebrations.length, 0)
  } finally {
    mock.timers.reset()
  }
})
