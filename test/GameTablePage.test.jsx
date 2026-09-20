import test from 'node:test'
import assert from 'node:assert/strict'
import '../test/setupDom.js'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

import { GameTablePage } from '../src/components/GameTablePage.jsx'

if (typeof window.ResizeObserver === 'undefined') {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = window.ResizeObserver
}

test.afterEach(() => {
  cleanup()
})

const buildBiddingGame = (overrides = {}) => ({
  id: 'game-1',
  version: 3,
  reactions: [],
  players: [
    { id: 'p1', name: 'Casey', type: 'human' },
    { id: 'p2', name: 'Robin', type: 'ai' },
    { id: 'p3', name: 'Jordan', type: 'ai' },
  ],
  playerOrder: ['p1', 'p2', 'p3'],
  scores: [
    { playerId: 'p1', total: 0, rounds: [] },
    { playerId: 'p2', total: 0, rounds: [] },
    { playerId: 'p3', total: 0, rounds: [] },
  ],
  options: { rounds: [{ cardCount: 6, direction: 'down' }] },
  phase: {
    stage: 'Bidding',
    roundIndex: 0,
    dealerPlayerId: 'p3',
    turnPlayerId: 'p1',
    bids: [],
    cards: {
      trump: { rank: '2', suit: 'Hearts' },
      trumpBroken: false,
      currentTrick: null,
      completedTricks: [],
      hands: [
        {
          playerId: 'p1',
          cards: [
            { rank: 'A', suit: 'Hearts' },
            { rank: 'K', suit: 'Clubs' },
          ],
        },
      ],
    },
  },
  ...overrides,
})

const buildProps = (overrides = {}) => ({
  game: buildBiddingGame(),
  isOwner: true,
  ownerPlayerId: 'p1',
  errorMessage: '',
  shareLink: 'https://example.com/g/game-1',
  isShareLinkCopied: false,
  onCopyShareLink: () => {},
  onSetGameError: () => {},
  onRenamePlayer: async () => true,
  onRemovePlayer: async () => {},
  onCoverAwayPlayerTurn: async () => {},
  onLeaveGame: async () => {},
  onGoHome: () => {},
  onDealCards: () => {},
  onSubmitBid: (event) => event.preventDefault(),
  onPlayCard: () => {},
  onSortCards: () => {},
  onStartOver: () => {},
  onSendReaction: () => {},
  onOpenHelp: () => {},
  onOpenNewGame: () => {},
  onOpenJoinGame: () => {},
  onInstallApp: () => {},
  ...overrides,
})

test('GameTablePage renders the roster, trump card, and bidding panel during Bidding', () => {
  render(<GameTablePage {...buildProps()} />)

  assert.ok(screen.getByText('Casey'))
  assert.ok(screen.getByText('Robin'))
  assert.ok(screen.getByText('Jordan'))
  assert.ok(screen.getAllByText('Your Turn to Bid').length > 0)
})

test('GameTablePage shows an error banner when errorMessage is set', () => {
  render(<GameTablePage {...buildProps({ errorMessage: 'Unable to submit bid.' })} />)

  assert.ok(screen.getByText('Unable to submit bid.'))
})

test('GameTablePage renders the trick area once the game moves to Playing', () => {
  const playingGame = buildBiddingGame({
    phase: {
      stage: 'Playing',
      roundIndex: 0,
      dealerPlayerId: 'p3',
      turnPlayerId: 'p1',
      trickIndex: 0,
      bids: [{ playerId: 'p1', amount: 3 }],
      cards: {
        trump: { rank: '2', suit: 'Hearts' },
        trumpBroken: false,
        currentTrick: { leadPlayerId: 'p1', plays: [] },
        completedTricks: [],
        hands: [
          {
            playerId: 'p1',
            cards: [
              { rank: 'A', suit: 'Hearts' },
              { rank: 'K', suit: 'Clubs' },
            ],
          },
        ],
      },
    },
  })

  render(<GameTablePage {...buildProps({ game: playingGame })} />)

  assert.ok(screen.getAllByText('Your Turn to Play').length > 0)
})

test('GameTablePage lets the owner open the score history modal', () => {
  render(<GameTablePage {...buildProps()} />)

  fireEvent.click(screen.getByText('See History'))

  assert.ok(screen.getByText('Game History'))
})

test('GameTablePage opens the game menu and surfaces the owner-only Reset action', () => {
  render(<GameTablePage {...buildProps()} />)

  fireEvent.click(screen.getAllByRole('button', { name: 'Open game menu' })[0])

  assert.ok(screen.getByRole('button', { name: 'Reset' }))
})

test('GameTablePage hides the Reset control for a non-owner viewer', () => {
  render(<GameTablePage {...buildProps({ isOwner: false })} />)

  fireEvent.click(screen.getAllByRole('button', { name: 'Open game menu' })[0])

  assert.equal(screen.queryByRole('button', { name: 'Reset' }), null)
})

test('GameTablePage renders the GameOver state, and confirming Reset calls onStartOver', () => {
  const gameOverGame = buildBiddingGame({
    phase: { stage: 'GameOver', roundIndex: 0 },
  })
  const calls = []
  render(<GameTablePage {...buildProps({ game: gameOverGame, onStartOver: () => calls.push('start-over') })} />)

  assert.ok(screen.getAllByText('Game Over').length > 0)

  fireEvent.click(screen.getAllByRole('button', { name: 'Open game menu' })[0])
  fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
  fireEvent.click(screen.getByRole('button', { name: 'Reset Game' }))
  assert.deepEqual(calls, ['start-over'])
})
