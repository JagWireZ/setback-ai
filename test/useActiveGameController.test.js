import test from 'node:test'
import assert from 'node:assert/strict'
import { mock } from 'node:test'

const lambdaClientUrl = new URL('../src/api/lambdaClient.js', import.meta.url).href

const coverAwayPlayerTurnMock = mock.fn()
const dealCardsMock = mock.fn()
const playCardMock = mock.fn()
const removeGameMock = mock.fn()
const removePlayerMock = mock.fn()
const returnFromAwayMock = mock.fn()
const sendReactionMock = mock.fn()
const sortCardsMock = mock.fn()
const startOverMock = mock.fn()
const submitBidMock = mock.fn()

mock.module(lambdaClientUrl, {
  exports: {
    coverAwayPlayerTurn: (...args) => coverAwayPlayerTurnMock(...args),
    dealCards: (...args) => dealCardsMock(...args),
    playCard: (...args) => playCardMock(...args),
    removeGame: (...args) => removeGameMock(...args),
    removePlayer: (...args) => removePlayerMock(...args),
    returnFromAway: (...args) => returnFromAwayMock(...args),
    sendReaction: (...args) => sendReactionMock(...args),
    sortCards: (...args) => sortCardsMock(...args),
    startOver: (...args) => startOverMock(...args),
    submitBid: (...args) => submitBidMock(...args),
  },
})

const { useActiveGameController } = await import('../src/hooks/useActiveGameController.js')

const ALL_MOCKS = [
  coverAwayPlayerTurnMock,
  dealCardsMock,
  playCardMock,
  removeGameMock,
  removePlayerMock,
  returnFromAwayMock,
  sendReactionMock,
  sortCardsMock,
  startOverMock,
  submitBidMock,
]

test.beforeEach(() => {
  for (const fn of ALL_MOCKS) {
    fn.mock.resetCalls()
    fn.mock.restore?.()
  }
})

const buildActions = () => ({
  setGameError: mock.fn(),
  setIsContinuingGame: mock.fn(),
  setIsDealingCards: mock.fn(),
  setIsLeavingGame: mock.fn(),
  setIsPlayingCard: mock.fn(),
  setIsSendingReaction: mock.fn(),
  setIsSortingCards: mock.fn(),
  setIsStartingOver: mock.fn(),
  setIsSubmittingBid: mock.fn(),
  setLobbyInfo: mock.fn(),
  setPendingPlayerActionId: mock.fn(),
  setReactionCooldownUntil: mock.fn(),
  setRequestError: mock.fn(),
  setSelectedAiDifficulty: mock.fn(),
  setSelectedMaxCards: mock.fn(),
  setSessionInfo: mock.fn(),
  setSortMode: mock.fn(),
})

const useTestController = (session, overrides = {}) =>
  useActiveGameController({
    appState: { session },
    appActions: buildActions(),
    currentRoundCardCount: 6,
    sortMode: 'bySuit',
    selectedBid: '2',
    isReactionOnCooldown: false,
    requestActiveStateReview: mock.fn(),
    applyRealtimeResult: mock.fn(),
    handleRemovedFromGame: mock.fn(),
    closeSubmitBidModal: mock.fn(),
    setSelectedBid: mock.fn(),
    setIsBidModalOpen: mock.fn(),
    setShowAwayContinueModal: mock.fn(),
    reactionCooldownTimeoutRef: { current: null },
    ...overrides,
  })

// --- Finding #13: handleContinueGame had no error handling, test-first. ---

test('handleContinueGame surfaces a generic error and resets the continuing flag when returnFromAway fails', async () => {
  returnFromAwayMock.mock.mockImplementation(async () => {
    throw new Error('Game not found')
  })

  const setGameError = mock.fn()
  const setIsContinuingGame = mock.fn()
  const setShowAwayContinueModal = mock.fn()
  const controller = useActiveGameController({
    appState: { session: { ownerSession: { gameId: 'game-1', playerToken: 'owner-token' }, playerSession: null } },
    appActions: { ...buildActions(), setGameError, setIsContinuingGame },
    currentRoundCardCount: 6,
    sortMode: 'bySuit',
    selectedBid: '2',
    isReactionOnCooldown: false,
    requestActiveStateReview: mock.fn(),
    applyRealtimeResult: mock.fn(),
    handleRemovedFromGame: mock.fn(),
    closeSubmitBidModal: mock.fn(),
    setSelectedBid: mock.fn(),
    setIsBidModalOpen: mock.fn(),
    setShowAwayContinueModal,
    reactionCooldownTimeoutRef: { current: null },
  })

  await assert.doesNotReject(() => controller.handleContinueGame())

  assert.equal(setGameError.mock.calls.at(-1).arguments[0], 'Unable to continue game.')
  assert.equal(setIsContinuingGame.mock.calls[0].arguments[0], true)
  assert.equal(setIsContinuingGame.mock.calls.at(-1).arguments[0], false)
  assert.equal(setShowAwayContinueModal.mock.calls.length, 0)
})

test('handleContinueGame requests a state review instead of a generic error on a concurrent update conflict', async () => {
  returnFromAwayMock.mock.mockImplementation(async () => {
    throw new Error('TransactionConflict: conditional check failed')
  })

  const setGameError = mock.fn()
  const requestActiveStateReview = mock.fn()
  const controller = useActiveGameController({
    appState: { session: { ownerSession: { gameId: 'game-1', playerToken: 'owner-token' }, playerSession: null } },
    appActions: { ...buildActions(), setGameError },
    currentRoundCardCount: 6,
    sortMode: 'bySuit',
    selectedBid: '2',
    isReactionOnCooldown: false,
    requestActiveStateReview,
    applyRealtimeResult: mock.fn(),
    handleRemovedFromGame: mock.fn(),
    closeSubmitBidModal: mock.fn(),
    setSelectedBid: mock.fn(),
    setIsBidModalOpen: mock.fn(),
    setShowAwayContinueModal: mock.fn(),
    reactionCooldownTimeoutRef: { current: null },
  })

  await assert.doesNotReject(() => controller.handleContinueGame())

  assert.equal(requestActiveStateReview.mock.calls.length, 1)
  assert.ok(!setGameError.mock.calls.some((call) => call.arguments[0]))
})

test('handleContinueGame closes the away modal and applies the result on success', async () => {
  returnFromAwayMock.mock.mockImplementation(async () => ({ game: { id: 'game-1' } }))

  const setShowAwayContinueModal = mock.fn()
  const applyRealtimeResult = mock.fn()
  const session = { ownerSession: null, playerSession: { gameId: 'game-1', playerToken: 'player-token' } }
  const controller = useActiveGameController({
    appState: { session },
    appActions: buildActions(),
    currentRoundCardCount: 6,
    sortMode: 'bySuit',
    selectedBid: '2',
    isReactionOnCooldown: false,
    requestActiveStateReview: mock.fn(),
    applyRealtimeResult,
    handleRemovedFromGame: mock.fn(),
    closeSubmitBidModal: mock.fn(),
    setSelectedBid: mock.fn(),
    setIsBidModalOpen: mock.fn(),
    setShowAwayContinueModal,
    reactionCooldownTimeoutRef: { current: null },
  })

  await controller.handleContinueGame()

  assert.equal(setShowAwayContinueModal.mock.calls[0].arguments[0], false)
  assert.equal(applyRealtimeResult.mock.calls[0].arguments[1], 'player')
})

test('handleContinueGame is a no-op without an active session', async () => {
  const controller = useTestController({ ownerSession: null, playerSession: null })

  await controller.handleContinueGame()

  assert.equal(returnFromAwayMock.mock.calls.length, 0)
})

// --- Remaining handlers: representative happy-path + failure coverage. ---

test('handleCoverAwayPlayerTurn is a no-op without an owner session', async () => {
  const controller = useTestController({ ownerSession: null, playerSession: null })

  const outcome = await controller.handleCoverAwayPlayerTurn('p2')

  assert.equal(outcome, false)
  assert.equal(coverAwayPlayerTurnMock.mock.calls.length, 0)
})

test('handleCoverAwayPlayerTurn applies the result on success', async () => {
  coverAwayPlayerTurnMock.mock.mockImplementation(async () => ({ game: { id: 'game-1' } }))
  const applyRealtimeResult = mock.fn()
  const controller = useTestController(
    { ownerSession: { gameId: 'game-1', playerToken: 'owner-token' }, playerSession: null },
    { applyRealtimeResult },
  )

  const outcome = await controller.handleCoverAwayPlayerTurn('p2')

  assert.equal(outcome, true)
  assert.equal(applyRealtimeResult.mock.calls[0].arguments[1], 'owner')
})

test('handleLeaveGame removes the game when acting as the owner', async () => {
  removeGameMock.mock.mockImplementation(async () => ({}))
  const handleRemovedFromGame = mock.fn()
  const controller = useTestController(
    { ownerSession: { gameId: 'game-1', playerToken: 'owner-token' }, playerSession: null },
    { handleRemovedFromGame },
  )

  const outcome = await controller.handleLeaveGame()

  assert.equal(outcome, true)
  assert.deepEqual(removeGameMock.mock.calls[0].arguments[0], { gameId: 'game-1', playerToken: 'owner-token' })
  assert.equal(handleRemovedFromGame.mock.calls[0].arguments[0], 'game-1')
})

test('handleLeaveGame removes the viewer player when acting as a player', async () => {
  removePlayerMock.mock.mockImplementation(async () => ({}))
  const handleRemovedFromGame = mock.fn()
  const playerSession = {
    gameId: 'game-2',
    playerToken: 'player-token',
    game: { phase: { stage: 'Playing', cards: { hands: [{ playerId: 'p9', cards: [] }] } } },
  }
  const controller = useTestController({ ownerSession: null, playerSession }, { handleRemovedFromGame })

  const outcome = await controller.handleLeaveGame()

  assert.equal(outcome, true)
  assert.deepEqual(removePlayerMock.mock.calls[0].arguments[0], {
    gameId: 'game-2',
    playerToken: 'player-token',
    playerId: 'p9',
  })
})

test('handleLeaveGame reports an error when the leaving player id cannot be determined', async () => {
  const setGameError = mock.fn()
  const playerSession = { gameId: 'game-2', playerToken: 'player-token', game: { phase: { stage: 'Bidding' } } }
  const controller = useActiveGameController({
    appState: { session: { ownerSession: null, playerSession } },
    appActions: { ...buildActions(), setGameError },
    currentRoundCardCount: 6,
    sortMode: 'bySuit',
    selectedBid: '2',
    isReactionOnCooldown: false,
    requestActiveStateReview: mock.fn(),
    applyRealtimeResult: mock.fn(),
    handleRemovedFromGame: mock.fn(),
    closeSubmitBidModal: mock.fn(),
    setSelectedBid: mock.fn(),
    setIsBidModalOpen: mock.fn(),
    setShowAwayContinueModal: mock.fn(),
    reactionCooldownTimeoutRef: { current: null },
  })

  const outcome = await controller.handleLeaveGame()

  assert.equal(outcome, false)
  assert.equal(removePlayerMock.mock.calls.length, 0)
  assert.equal(setGameError.mock.calls.at(-1).arguments[0], 'Unable to determine which player should leave this game')
})

test('handleSubmitBid sends a trip bid using the current round card count', async () => {
  submitBidMock.mock.mockImplementation(async () => ({ game: { id: 'game-1' } }))
  const closeSubmitBidModal = mock.fn()
  const controller = useTestController(
    { ownerSession: { gameId: 'game-1', playerToken: 'owner-token' }, playerSession: null },
    { selectedBid: 'trip', currentRoundCardCount: 3, closeSubmitBidModal },
  )

  await controller.handleSubmitBid({ preventDefault: () => {} })

  assert.deepEqual(submitBidMock.mock.calls[0].arguments[0], {
    gameId: 'game-1',
    playerToken: 'owner-token',
    bid: 3,
    trip: true,
  })
  assert.equal(closeSubmitBidModal.mock.calls.length, 1)
})

test('handleSubmitBid on a concurrent conflict requests a state review instead of setting an error', async () => {
  submitBidMock.mock.mockImplementation(async () => {
    throw new Error('Transaction cancelled')
  })
  const setGameError = mock.fn()
  const requestActiveStateReview = mock.fn()
  const controller = useActiveGameController({
    appState: { session: { ownerSession: { gameId: 'game-1', playerToken: 'owner-token' }, playerSession: null } },
    appActions: { ...buildActions(), setGameError },
    currentRoundCardCount: 6,
    sortMode: 'bySuit',
    selectedBid: '2',
    isReactionOnCooldown: false,
    requestActiveStateReview,
    applyRealtimeResult: mock.fn(),
    handleRemovedFromGame: mock.fn(),
    closeSubmitBidModal: mock.fn(),
    setSelectedBid: mock.fn(),
    setIsBidModalOpen: mock.fn(),
    setShowAwayContinueModal: mock.fn(),
    reactionCooldownTimeoutRef: { current: null },
  })

  await controller.handleSubmitBid({ preventDefault: () => {} })

  assert.equal(requestActiveStateReview.mock.calls.length, 1)
  assert.ok(!setGameError.mock.calls.some((call) => call.arguments[0]))
})

test('handleSortCards is blocked while the game is in the Dealing phase', async () => {
  const controller = useTestController({
    ownerSession: { gameId: 'game-1', playerToken: 'owner-token', game: { phase: { stage: 'Dealing' } } },
    playerSession: null,
  })

  await controller.handleSortCards('byRank')

  assert.equal(sortCardsMock.mock.calls.length, 0)
})

test('toggleSortCards flips between bySuit and byRank', async () => {
  sortCardsMock.mock.mockImplementation(async () => ({ game: { id: 'game-1' } }))
  const setSortMode = mock.fn()
  const controller = useTestController(
    { ownerSession: { gameId: 'game-1', playerToken: 'owner-token', game: { phase: { stage: 'Playing' } } }, playerSession: null },
    { sortMode: 'bySuit', setSortMode },
  )

  await controller.toggleSortCards()

  assert.deepEqual(sortCardsMock.mock.calls[0].arguments[0], {
    gameId: 'game-1',
    playerToken: 'owner-token',
    mode: 'byRank',
  })
})

test('handlePlayCard is a no-op without an active game', async () => {
  const controller = useTestController({ ownerSession: null, playerSession: null })

  await controller.handlePlayCard({ rank: 'A', suit: 'Hearts' })

  assert.equal(playCardMock.mock.calls.length, 0)
})

test('handleSendReaction normalizes emoji and phrase inputs and starts the cooldown timer', async () => {
  sendReactionMock.mock.mockImplementation(async () => ({ game: { id: 'game-1' } }))
  const setReactionCooldownUntil = mock.fn()
  const reactionCooldownTimeoutRef = { current: null }
  const controller = useActiveGameController({
    appState: { session: { ownerSession: { gameId: 'game-1', playerToken: 'owner-token' }, playerSession: null } },
    appActions: { ...buildActions(), setReactionCooldownUntil },
    currentRoundCardCount: 6,
    sortMode: 'bySuit',
    selectedBid: '2',
    isReactionOnCooldown: false,
    requestActiveStateReview: mock.fn(),
    applyRealtimeResult: mock.fn(),
    handleRemovedFromGame: mock.fn(),
    closeSubmitBidModal: mock.fn(),
    setSelectedBid: mock.fn(),
    setIsBidModalOpen: mock.fn(),
    setShowAwayContinueModal: mock.fn(),
    reactionCooldownTimeoutRef,
  })

  await controller.handleSendReaction('👏')
  assert.deepEqual(sendReactionMock.mock.calls[0].arguments[0], {
    gameId: 'game-1',
    playerToken: 'owner-token',
    emoji: '👏',
  })
  assert.equal(setReactionCooldownUntil.mock.calls.length, 1)
  assert.ok(reactionCooldownTimeoutRef.current)

  clearTimeout(reactionCooldownTimeoutRef.current)
})

test('handleSendReaction is a no-op while on cooldown', async () => {
  const controller = useTestController(
    { ownerSession: { gameId: 'game-1', playerToken: 'owner-token' }, playerSession: null },
    { isReactionOnCooldown: true },
  )

  await controller.handleSendReaction('👏')

  assert.equal(sendReactionMock.mock.calls.length, 0)
})

test('handleSendReaction rethrows a non-concurrency error after setting the generic message', async () => {
  sendReactionMock.mock.mockImplementation(async () => {
    throw new Error('boom')
  })
  const controller = useTestController({ ownerSession: { gameId: 'game-1', playerToken: 'owner-token' }, playerSession: null })

  await assert.rejects(() => controller.handleSendReaction('👏'), /boom/)
})

test('handleStartOver applies the result and resyncs lobby options', async () => {
  startOverMock.mock.mockImplementation(async () => ({
    game: { id: 'game-1', options: { maxCards: 6, aiDifficulty: 'easy' } },
  }))
  const setSelectedMaxCards = mock.fn()
  const setSelectedAiDifficulty = mock.fn()
  const controller = useActiveGameController({
    appState: { session: { ownerSession: { gameId: 'game-1', playerToken: 'owner-token' }, playerSession: null } },
    appActions: { ...buildActions(), setSelectedMaxCards, setSelectedAiDifficulty },
    currentRoundCardCount: 6,
    sortMode: 'bySuit',
    selectedBid: '2',
    isReactionOnCooldown: false,
    requestActiveStateReview: mock.fn(),
    applyRealtimeResult: mock.fn(),
    handleRemovedFromGame: mock.fn(),
    closeSubmitBidModal: mock.fn(),
    setSelectedBid: mock.fn(),
    setIsBidModalOpen: mock.fn(),
    setShowAwayContinueModal: mock.fn(),
    reactionCooldownTimeoutRef: { current: null },
  })

  await controller.handleStartOver()

  assert.equal(setSelectedMaxCards.mock.calls[0].arguments[0], '6')
  assert.equal(setSelectedAiDifficulty.mock.calls[0].arguments[0], 'easy')
})

test('openSubmitBidModal resets the selected bid and opens the modal', () => {
  const setSelectedBid = mock.fn()
  const setIsBidModalOpen = mock.fn()
  const controller = useTestController(
    { ownerSession: null, playerSession: null },
    { setSelectedBid, setIsBidModalOpen },
  )

  controller.openSubmitBidModal()

  assert.equal(setSelectedBid.mock.calls[0].arguments[0], '0')
  assert.equal(setIsBidModalOpen.mock.calls[0].arguments[0], true)
})
