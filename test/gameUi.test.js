import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildRoundSummary,
  getBidDisplay,
  getCardDisplay,
  getCardLabel,
  getCompletedRoundCount,
  getInvalidPlayMessage,
  getMaxCardsForSeatCount,
  getPlayerName,
  getRoundDirectionArrow,
  getViewerHand,
  hashString,
  sortHandCards,
  toUserFacingActionError,
} from '../src/utils/gameUi.js'

test('getPlayerName looks up a player by id and falls back to Unknown', () => {
  const game = { players: [{ id: 'p1', name: 'Casey' }] }

  assert.equal(getPlayerName(game, 'p1'), 'Casey')
  assert.equal(getPlayerName(game, 'missing'), 'Unknown')
  assert.equal(getPlayerName(undefined, 'p1'), 'Unknown')
})

test('getMaxCardsForSeatCount caps at 10 and floors uneven splits', () => {
  assert.equal(getMaxCardsForSeatCount(4), 10)
  assert.equal(getMaxCardsForSeatCount(6), 8)
  assert.equal(getMaxCardsForSeatCount(9), 5)
})

test('getMaxCardsForSeatCount defaults invalid counts to 1', () => {
  assert.equal(getMaxCardsForSeatCount(0), 1)
  assert.equal(getMaxCardsForSeatCount(-2), 1)
  assert.equal(getMaxCardsForSeatCount(2.5), 1)
  assert.equal(getMaxCardsForSeatCount(undefined), 1)
})

test('getBidDisplay renders trip, numeric, and pending bids', () => {
  assert.equal(getBidDisplay({ trip: true, amount: 4 }), 'Trip')
  assert.equal(getBidDisplay({ amount: 3 }), '3')
  assert.equal(getBidDisplay({ amount: 0 }), '0')
  assert.equal(getBidDisplay(undefined), '...')
})

const buildPlayingGame = ({ turnPlayerId = 'p1', trumpSuit = 'Hearts', trumpBroken = false, currentTrick } = {}) => ({
  phase: {
    stage: 'Playing',
    turnPlayerId,
    cards: {
      trump: { suit: trumpSuit },
      trumpBroken,
      currentTrick,
    },
  },
})

test('getInvalidPlayMessage is silent when it is not the viewer\'s turn or no card selected', () => {
  const game = buildPlayingGame({ turnPlayerId: 'p2' })
  const hand = { playerId: 'p1', cards: [] }

  assert.equal(getInvalidPlayMessage(game, hand, { rank: 'A', suit: 'Hearts' }), '')
  assert.equal(getInvalidPlayMessage(buildPlayingGame(), hand, undefined), '')
})

test('getInvalidPlayMessage requires following the lead suit when able', () => {
  const game = buildPlayingGame({
    currentTrick: { plays: [{ playerId: 'p2', card: { rank: '9', suit: 'Clubs' } }] },
  })
  const hand = {
    playerId: 'p1',
    cards: [
      { rank: 'K', suit: 'Clubs' },
      { rank: 'A', suit: 'Hearts' },
    ],
  }

  assert.equal(
    getInvalidPlayMessage(game, hand, { rank: 'A', suit: 'Hearts' }),
    'You must follow Clubs.',
  )
  assert.equal(getInvalidPlayMessage(game, hand, { rank: 'K', suit: 'Clubs' }), '')
})

test('getInvalidPlayMessage blocks leading trump before it is broken', () => {
  const game = buildPlayingGame({ trumpBroken: false })
  const hand = {
    playerId: 'p1',
    cards: [
      { rank: 'A', suit: 'Hearts' },
      { rank: 'K', suit: 'Clubs' },
    ],
  }

  assert.equal(
    getInvalidPlayMessage(game, hand, { rank: 'A', suit: 'Hearts' }),
    'You cannot lead with Hearts until trump is broken.',
  )
})

test('getInvalidPlayMessage allows leading trump when the hand is all trump', () => {
  const game = buildPlayingGame({ trumpBroken: false })
  const hand = {
    playerId: 'p1',
    cards: [
      { rank: 'A', suit: 'Hearts' },
      { rank: 'K', suit: 'Hearts' },
    ],
  }

  assert.equal(getInvalidPlayMessage(game, hand, { rank: 'A', suit: 'Hearts' }), '')
})

test('getInvalidPlayMessage is silent outside the Playing phase or without a viewer hand', () => {
  const biddingGame = { phase: { stage: 'Bidding' } }
  assert.equal(getInvalidPlayMessage(biddingGame, { playerId: 'p1', cards: [] }, { rank: 'A', suit: 'Hearts' }), '')

  const game = buildPlayingGame()
  assert.equal(getInvalidPlayMessage(game, { cards: [] }, { rank: 'A', suit: 'Hearts' }), '')
})

test('getInvalidPlayMessage is silent once the viewer has already played to the trick', () => {
  const game = buildPlayingGame({
    currentTrick: { plays: [{ playerId: 'p1', card: { rank: '9', suit: 'Clubs' } }] },
  })
  const hand = { playerId: 'p1', cards: [{ rank: 'A', suit: 'Hearts' }] }

  assert.equal(getInvalidPlayMessage(game, hand, { rank: 'A', suit: 'Hearts' }), '')
})

test('toUserFacingActionError maps known transient failures to friendly copy', () => {
  assert.equal(
    toUserFacingActionError(new Error('TransactionConflict: conditional check failed'), 'fallback'),
    'Another move updated the game at the same time. Please try again.',
  )
  assert.equal(
    toUserFacingActionError(new Error('Transaction cancelled'), 'fallback'),
    'Another move updated the game at the same time. Please try again.',
  )
  assert.equal(
    toUserFacingActionError(new Error('Rate exceeded for this identity'), 'fallback'),
    'The service is a little busy right now. Please wait a moment and try again.',
  )
  assert.equal(
    toUserFacingActionError(new Error('Please slow down, throttling in effect'), 'fallback'),
    'The service is a little busy right now. Please wait a moment and try again.',
  )
})

test('toUserFacingActionError passes through other error messages and non-Error fallbacks', () => {
  assert.equal(toUserFacingActionError(new Error('Invalid player token'), 'fallback'), 'Invalid player token')
  assert.equal(toUserFacingActionError('not an error object', 'fallback message'), 'fallback message')
})

test('hashString is deterministic and sensitive to input', () => {
  assert.equal(hashString('setback'), hashString('setback'))
  assert.notEqual(hashString('setback'), hashString('setback!'))
  assert.equal(hashString(''), 0)
})

test('getCardLabel formats standard cards and jokers, defaults for missing cards', () => {
  assert.equal(getCardLabel({ rank: 'K', suit: 'Hearts' }), 'K of Hearts')
  assert.equal(getCardLabel({ rank: 'BJ', suit: 'Joker' }), 'Big Joker')
  assert.equal(getCardLabel({ rank: 'LJ', suit: 'Joker' }), 'Little Joker')
  assert.equal(getCardLabel(undefined), 'Unknown card')
  assert.equal(getCardLabel({ rank: 'A' }), 'Unknown card')
})

test('getCardDisplay returns symbol metadata for standard cards, jokers, and unknowns', () => {
  assert.deepEqual(getCardDisplay({ rank: 'A', suit: 'Spades' }), { rank: 'A', suit: '♠️', center: '♠️' })
  assert.deepEqual(getCardDisplay({ rank: 'BJ', suit: 'Joker' }), {
    rank: 'BJ',
    suit: '⭐',
    center: '⭐',
    accent: 'BIG',
  })
  assert.deepEqual(getCardDisplay({ rank: 'LJ', suit: 'Joker' }), {
    rank: 'LJ',
    suit: '⭐',
    center: '⭐',
    accent: 'LITTLE',
  })
  assert.deepEqual(getCardDisplay(undefined), { rank: '?', suit: '', center: '?' })
})

test('getRoundDirectionArrow maps up/down directions', () => {
  assert.equal(getRoundDirectionArrow('up'), '⬆')
  assert.equal(getRoundDirectionArrow('down'), '⬇')
})

test('getCompletedRoundCount uses the recorded score history when phase has no round index', () => {
  const game = { scores: [{ rounds: [1, 2, 3] }, { rounds: [1, 2] }] }
  assert.equal(getCompletedRoundCount(game), 3)
  assert.equal(getCompletedRoundCount(undefined), 0)
})

test('getCompletedRoundCount reflects EndOfRound as the round having just completed', () => {
  const game = {
    scores: [{ rounds: [1, 2, 3] }],
    phase: { stage: 'EndOfRound', roundIndex: 1 },
  }
  assert.equal(getCompletedRoundCount(game), 2)
})

test('getCompletedRoundCount reflects an in-progress round as not yet completed', () => {
  const game = {
    scores: [{ rounds: [1, 2, 3] }],
    phase: { stage: 'Bidding', roundIndex: 2 },
  }
  assert.equal(getCompletedRoundCount(game), 2)
})

test('buildRoundSummary is null for a missing game, negative round, or unconfigured round', () => {
  assert.equal(buildRoundSummary(undefined, 0), null)
  assert.equal(buildRoundSummary({ options: { rounds: [] } }, -1), null)
  assert.equal(buildRoundSummary({ options: { rounds: [] } }, 0), null)
})

test('buildRoundSummary ranks players by score descending and fills in defaults', () => {
  const game = {
    options: { rounds: [{ cardCount: 6, direction: 'down' }] },
    playerOrder: ['p1', 'p2'],
    players: [
      { id: 'p1', name: 'Casey' },
      { id: 'p2', name: 'Robin' },
    ],
    scores: [
      { playerId: 'p1', rounds: [{ bid: 3, books: 3, total: 30, rainbow: true }] },
      { playerId: 'p2', rounds: [] },
    ],
  }

  assert.deepEqual(buildRoundSummary(game, 0), {
    roundIndex: 0,
    cardCount: 6,
    direction: 'down',
    players: [
      { playerId: 'p1', name: 'Casey', bid: 3, books: 3, score: 30, rainbow: true },
      { playerId: 'p2', name: 'Robin', bid: 0, books: 0, score: 0, rainbow: false },
    ],
  })
})

test('getViewerHand returns the first hand in the phase or null otherwise', () => {
  assert.equal(getViewerHand(undefined), null)
  assert.equal(getViewerHand({ phase: { stage: 'Bidding' } }), null)

  const game = { phase: { stage: 'Playing', cards: { hands: [{ playerId: 'p1', cards: [] }] } } }
  assert.deepEqual(getViewerHand(game), { playerId: 'p1', cards: [] })
})

test('sortHandCards byRank orders by rank then a fixed suit order', () => {
  const cards = [
    { rank: 'A', suit: 'Spades' },
    { rank: '2', suit: 'Hearts' },
    { rank: 'A', suit: 'Clubs' },
  ]

  assert.deepEqual(sortHandCards(cards, 'byRank'), [
    { rank: '2', suit: 'Hearts' },
    { rank: 'A', suit: 'Clubs' },
    { rank: 'A', suit: 'Spades' },
  ])
})

test('sortHandCards bySuit groups trump last and jokers after trump', () => {
  const cards = [
    { rank: 'A', suit: 'Spades' },
    { rank: 'BJ', suit: 'Joker' },
    { rank: '2', suit: 'Hearts' },
    { rank: 'K', suit: 'Hearts' },
  ]

  assert.deepEqual(sortHandCards(cards, 'bySuit', 'Hearts'), [
    { rank: 'A', suit: 'Spades' },
    { rank: '2', suit: 'Hearts' },
    { rank: 'K', suit: 'Hearts' },
    { rank: 'BJ', suit: 'Joker' },
  ])
})

test('sortHandCards defaults to an empty array for non-array input', () => {
  assert.deepEqual(sortHandCards(undefined), [])
  assert.deepEqual(sortHandCards(null, 'byRank'), [])
})
