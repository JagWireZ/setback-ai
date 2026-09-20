import test from 'node:test'
import assert from 'node:assert/strict'
import '../test/setupDom.js'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'

import { RoundStatusLabel, ScoreHistory, ScoreSheet, ScoreSummary } from '../src/components/Scoreboard.jsx'

test.afterEach(() => {
  cleanup()
})

const buildGame = (overrides = {}) => ({
  id: 'game-1',
  playerOrder: ['p1', 'p2'],
  players: [
    { id: 'p1', name: 'Casey', type: 'human' },
    { id: 'p2', name: 'Robin', type: 'ai' },
  ],
  scores: [
    { playerId: 'p1', total: 12, rounds: [{ bid: 3, books: 3, total: 3, rainbow: false }] },
    { playerId: 'p2', total: 20, rounds: [{ bid: 4, books: 4, total: 4, rainbow: true }] },
  ],
  phase: { stage: 'Playing', dealerPlayerId: 'p2', turnPlayerId: 'p1' },
  options: { rounds: [{ cardCount: 6, direction: 'down' }] },
  ...overrides,
})

test('ScoreSummary renders each player with role icon, score, bid, and books', () => {
  const game = buildGame()
  render(<ScoreSummary game={game} bids={[]} booksByPlayerId={new Map()} currentRoundIndex={0} />)

  assert.ok(screen.getByText('👤 Casey'))
  assert.ok(screen.getByText('🤖 Robin'))
  assert.ok(screen.getByText('12'))
  assert.ok(screen.getByText('20'))
})

test('ScoreSummary marks the dealer badge on the current dealer', () => {
  const game = buildGame()
  render(<ScoreSummary game={game} bids={[]} booksByPlayerId={new Map()} currentRoundIndex={0} />)

  assert.ok(screen.getByText('Dealer'))
})

test('ScoreSummary shows an Away badge for a disconnected human player', () => {
  const game = buildGame({
    players: [
      { id: 'p1', name: 'Casey', type: 'human', connected: false },
      { id: 'p2', name: 'Robin', type: 'ai' },
    ],
  })
  render(<ScoreSummary game={game} bids={[]} booksByPlayerId={new Map()} currentRoundIndex={0} />)

  assert.ok(screen.getByText('Away'))
})

test('ScoreSummary orders players by score descending once the game is over', () => {
  const game = buildGame()
  render(
    <ScoreSummary game={game} bids={[]} booksByPlayerId={new Map()} currentRoundIndex={0} isGameOver />,
  )

  const names = screen.getAllByText(/Casey|Robin/).map((node) => node.textContent)
  assert.deepEqual(names, ['🤖 Robin', '👤 Casey'])
})

test('ScoreSummary calls onSelectPlayer only for players the viewer is allowed to manage', () => {
  const game = buildGame()
  const onSelectPlayer = () => {}

  const first = render(
    <ScoreSummary
      game={game}
      bids={[]}
      booksByPlayerId={new Map()}
      currentRoundIndex={0}
      onSelectPlayer={onSelectPlayer}
    />,
  )
  assert.equal(screen.queryByRole('button', { name: 'Edit Casey' }), null)
  first.unmount()

  render(
    <ScoreSummary
      game={game}
      bids={[]}
      booksByPlayerId={new Map()}
      currentRoundIndex={0}
      onSelectPlayer={onSelectPlayer}
      isOwner
    />,
  )
  assert.ok(screen.getByRole('button', { name: 'Manage Casey' }))
})

test('ScoreSummary shows the current bid and book count for the active round', () => {
  const game = buildGame()
  const bids = [{ playerId: 'p1', amount: 3 }]
  const booksByPlayerId = new Map([['p1', 2]])
  render(<ScoreSummary game={game} bids={bids} booksByPlayerId={booksByPlayerId} currentRoundIndex={0} />)

  assert.ok(screen.getByText('3'))
  assert.ok(screen.getByText('2'))
})

test('ScoreHistory shows a placeholder when there are no completed rounds', () => {
  const game = buildGame({ scores: [], phase: { stage: 'Bidding', roundIndex: 0 } })
  render(<ScoreHistory game={game} onClose={() => {}} />)

  assert.ok(screen.getByText('No completed rounds yet.'))
})

test('ScoreHistory renders a table of results per completed round, sorted by score, and closes on button click', () => {
  const game = buildGame({ phase: { stage: 'EndOfRound', roundIndex: 0 } })
  const clicks = []
  render(<ScoreHistory game={game} onClose={() => clicks.push('close')} />)

  assert.ok(screen.getByText('Round 6 ⬇'))
  const rows = screen.getAllByRole('row').slice(1)
  assert.equal(within(rows[0]).getByText('Robin').textContent, 'Robin')
  assert.equal(within(rows[1]).getByText('Casey').textContent, 'Casey')

  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  assert.deepEqual(clicks, ['close'])
})

test('RoundStatusLabel reflects game-over, an active round, or an unknown round', () => {
  const first = render(<RoundStatusLabel isGameOver currentRoundConfig={null} />)
  assert.ok(screen.getByText('Game Over'))
  first.unmount()

  render(<RoundStatusLabel isGameOver={false} currentRoundConfig={{ cardCount: 6, direction: 'up' }} />)
  assert.ok(screen.getByText('Round 6'))
})

test('RoundStatusLabel falls back to "Round N/A" without a current round config', () => {
  render(<RoundStatusLabel isGameOver={false} currentRoundConfig={null} />)
  assert.ok(screen.getByText('Round N/A'))
})

test('ScoreSheet renders the title, summary, and wires up history/close actions', () => {
  const game = buildGame()
  const events = []
  render(
    <ScoreSheet
      title="Final Score"
      game={game}
      bids={[]}
      booksByPlayerId={new Map()}
      currentRoundIndex={0}
      currentRoundConfig={{ cardCount: 6, direction: 'down' }}
      isGameOver={false}
      isOwner={false}
      onOpenHistory={() => events.push('history')}
      onClose={() => events.push('close')}
    />,
  )

  assert.ok(screen.getByText('Final Score'))
  fireEvent.click(screen.getByRole('button', { name: 'See History' }))
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  assert.deepEqual(events, ['history', 'close'])
})

test('ScoreSheet omits the Close button when onClose is not provided', () => {
  const game = buildGame()
  render(
    <ScoreSheet
      game={game}
      bids={[]}
      booksByPlayerId={new Map()}
      currentRoundIndex={0}
      currentRoundConfig={null}
      isGameOver={false}
      isOwner={false}
      onOpenHistory={() => {}}
    />,
  )

  assert.equal(screen.queryByRole('button', { name: 'Close' }), null)
})
