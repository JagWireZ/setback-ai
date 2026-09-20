import test from 'node:test'
import assert from 'node:assert/strict'
import { mock } from 'node:test'
import '../test/setupDom.js'
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react'

if (typeof window.ResizeObserver === 'undefined') {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = window.ResizeObserver
}

// This suite mocks the WebSocket boundary (`lambdaClient.js`) with an in-memory fake backend
// and renders the real hook composition + screen components together (the same wiring
// `App.jsx` does) to verify a full session flows correctly through the frontend end to end:
// create -> lobby -> start -> deal -> bid -> play -> round complete -> game over.

const lambdaClientUrl = new URL('../src/api/lambdaClient.js', import.meta.url).href

const GAME_ID = 'brave-otter'
const OWNER_TOKEN = 'owner-token'
const HOST_ID = 'p0'
const AI_IDS = ['p1', 'p2', 'p3', 'p4']
const BASE_PLAYERS = [
  { id: HOST_ID, name: '', type: 'human' },
  { id: 'p1', name: 'Bot Alpha', type: 'ai' },
  { id: 'p2', name: 'Bot Beta', type: 'ai' },
  { id: 'p3', name: 'Bot Gamma', type: 'ai' },
  { id: 'p4', name: 'Bot Delta', type: 'ai' },
]
const PLAYER_ORDER = BASE_PLAYERS.map((player) => player.id)

let fakeGame
let fakeVersion

const nextVersion = () => {
  fakeVersion += 1
  return fakeVersion
}

const buildScores = () => PLAYER_ORDER.map((playerId) => ({ playerId, total: 0, possible: 0, rounds: [] }))

const resetFakeBackend = () => {
  fakeGame = null
  fakeVersion = 0
}

const fakeCreateGame = async ({ playerName }) => {
  fakeGame = {
    id: GAME_ID,
    version: nextVersion(),
    phase: { stage: 'Lobby' },
    options: { maxCards: 10, blindBid: false, aiDifficulty: 'medium', rounds: [] },
    players: BASE_PLAYERS.map((player) => (player.id === HOST_ID ? { ...player, name: playerName } : { ...player })),
    playerOrder: [...PLAYER_ORDER],
    scores: buildScores(),
    reactions: [],
  }
  return { game: fakeGame, playerToken: OWNER_TOKEN, version: fakeGame.version }
}

const fakeStartGame = async ({ maxCards, aiDifficulty }) => {
  fakeGame = {
    ...fakeGame,
    version: nextVersion(),
    options: { ...fakeGame.options, maxCards, aiDifficulty, rounds: [{ cardCount: 1, direction: 'down' }] },
    phase: {
      stage: 'Dealing',
      dealerPlayerId: HOST_ID,
      turnPlayerId: HOST_ID,
      turnStartedAt: Date.now(),
      roundIndex: 0,
      trickIndex: 0,
      bids: [],
      cards: {
        deck: [],
        trump: undefined,
        trumpBroken: false,
        hands: [{ playerId: HOST_ID, cards: [] }],
        completedTricks: [],
      },
    },
  }
  return { game: fakeGame, version: fakeGame.version }
}

// Bidding order goes around the table after the dealer; since every seat except the dealer
// (the host) is AI-controlled, a real backend would auto-resolve those bids instantly, so the
// fake collapses straight to the host's turn to bid, same as the backend integration test does.
const fakeDealCards = async () => {
  fakeGame = {
    ...fakeGame,
    version: nextVersion(),
    phase: {
      stage: 'Bidding',
      dealerPlayerId: HOST_ID,
      turnPlayerId: HOST_ID,
      turnStartedAt: Date.now(),
      roundIndex: 0,
      trickIndex: 0,
      bids: AI_IDS.map((playerId) => ({ playerId, amount: 0, trip: false })),
      cards: {
        deck: [],
        trump: { rank: 'K', suit: 'Spades' },
        trumpBroken: false,
        hands: [{ playerId: HOST_ID, cards: [{ rank: 'A', suit: 'Hearts' }] }],
        completedTricks: [],
      },
    },
  }
  return { game: fakeGame, version: fakeGame.version }
}

const fakeSubmitBid = async ({ bid, trip }) => {
  fakeGame = {
    ...fakeGame,
    version: nextVersion(),
    phase: {
      ...fakeGame.phase,
      stage: 'Playing',
      turnPlayerId: HOST_ID,
      turnStartedAt: Date.now(),
      bids: [...fakeGame.phase.bids, { playerId: HOST_ID, amount: bid, trip: Boolean(trip) }],
      cards: {
        ...fakeGame.phase.cards,
        currentTrick: undefined,
      },
    },
  }
  return { game: fakeGame, version: fakeGame.version }
}

// The host leads and plays the only card in this one-card round; the remaining AI seats'
// plays are folded into the same completed trick, mirroring how a real game (with the AI
// runner) would resolve them before the round moves to scoring.
const fakePlayCard = async ({ card }) => {
  const completedTrick = {
    index: 0,
    leadPlayerId: HOST_ID,
    winnerPlayerId: HOST_ID,
    plays: [
      { playerId: HOST_ID, card },
      { playerId: 'p1', card: { rank: '2', suit: 'Clubs' } },
      { playerId: 'p2', card: { rank: '3', suit: 'Clubs' } },
      { playerId: 'p3', card: { rank: '4', suit: 'Clubs' } },
      { playerId: 'p4', card: { rank: '5', suit: 'Clubs' } },
    ],
  }

  fakeGame = {
    ...fakeGame,
    version: nextVersion(),
    scores: fakeGame.scores.map((score) => ({
      ...score,
      total: score.playerId === HOST_ID ? 10 : 0,
      rounds: [...score.rounds, { bid: score.playerId === HOST_ID ? 0 : 0, books: score.playerId === HOST_ID ? 1 : 0 }],
    })),
    phase: {
      ...fakeGame.phase,
      stage: 'EndOfRound',
      advanceAfter: Date.now(),
      trickIndex: fakeGame.phase.trickIndex + 1,
      cards: {
        ...fakeGame.phase.cards,
        hands: [{ playerId: HOST_ID, cards: [] }],
        currentTrick: undefined,
        completedTricks: [completedTrick],
      },
    },
  }
  return { game: fakeGame, version: fakeGame.version }
}

// Mirrors the real backend contract: the trick-reveal delay only advances once the client
// polls via checkState (see backend/test/fullGameFlow.test.js), which useAppRuntime does
// automatically once `advanceAfter` is due.
const fakeCheckState = async () => {
  if (fakeGame.phase.stage === 'EndOfRound') {
    fakeGame = { ...fakeGame, version: nextVersion(), phase: { stage: 'GameOver' } }
  }
  return { game: fakeGame, version: fakeGame.version }
}

const createGameMock = mock.fn((...args) => fakeCreateGame(...args))
const startGameMock = mock.fn((...args) => fakeStartGame(...args))
const dealCardsMock = mock.fn((...args) => fakeDealCards(...args))
const submitBidMock = mock.fn((...args) => fakeSubmitBid(...args))
const playCardMock = mock.fn((...args) => fakePlayCard(...args))
const checkStateMock = mock.fn((...args) => fakeCheckState(...args))
const subscribeToGameEventsMock = mock.fn(() => () => {})
const setActiveGameSessionMock = mock.fn()
const unusedMock = () => mock.fn(() => Promise.reject(new Error('not used in this flow')))

mock.module(lambdaClientUrl, {
  exports: {
    createGame: (...args) => createGameMock(...args),
    startGame: (...args) => startGameMock(...args),
    dealCards: (...args) => dealCardsMock(...args),
    submitBid: (...args) => submitBidMock(...args),
    playCard: (...args) => playCardMock(...args),
    checkState: (...args) => checkStateMock(...args),
    subscribeToGameEvents: (...args) => subscribeToGameEventsMock(...args),
    setActiveGameSession: (...args) => setActiveGameSessionMock(...args),
    joinGame: unusedMock(),
    renamePlayer: unusedMock(),
    returnFromAway: unusedMock(),
    getGameState: unusedMock(),
    coverAwayPlayerTurn: unusedMock(),
    removeGame: unusedMock(),
    removePlayer: unusedMock(),
    sendReaction: unusedMock(),
    sortCards: unusedMock(),
    startOver: unusedMock(),
    addSeat: unusedMock(),
    movePlayer: unusedMock(),
    removeSeat: unusedMock(),
  },
})

const { useAppState } = await import('../src/hooks/useAppState.js')
const { useAppModalState } = await import('../src/hooks/useAppModalState.js')
const { useLobbyController } = await import('../src/hooks/useLobbyController.js')
const { useAppRuntime } = await import('../src/hooks/useAppRuntime.js')
const { useSessionActions } = await import('../src/hooks/useSessionActions.js')
const { useActiveGameController } = await import('../src/hooks/useActiveGameController.js')
const { AppRoutes } = await import('../src/components/AppRoutes.jsx')
const { sanitizePlayerNameInput } = await import('../src/utils/playerName.js')
const {
  buildActiveGameProps,
  buildHomeProps,
  buildLobbyProps,
  buildModalProps,
} = await import('../src/utils/appRouteProps.js')

// Reconstructs the same hook wiring as `src/App.jsx`, minus the PWA-install/build-badge
// concerns (which pull in `import.meta.env` and don't build under this test runner).
function TestApp() {
  const { appState, appActions } = useAppState()
  const { home, session, game, requests } = appState
  const {
    createErrors,
    joinErrors,
    joinGameId,
    joinMenuCloseRequestKey,
    joinPlayerName,
    playerName,
    rejoinableGames,
    requestError,
    selectedRejoinGameId,
    sessionInfo,
  } = home
  const { ownerSession, playerSession } = session
  const {
    gameError,
    lobbyInfo,
    pendingPlayerActionId,
    persistedEndOfRoundSummary,
    reactionCooldownUntil,
    selectedAiDifficulty,
    selectedMaxCards,
    sortMode,
  } = game
  const {
    isContinuingGame,
    isCreatingGame,
    isDealingCards,
    isJoiningGame,
    isLeavingGame,
    isLoadingRejoinGames,
    isPlayingCard,
    isRejoiningGame,
    isRenamingPlayer,
    isSendingReaction,
    isSortingCards,
    isStartingGame,
    isStartingOver,
    isSubmittingBid,
  } = requests
  const {
    clearHomeRequestState,
    rejoinSelectionChanged,
    resetCreateDraft,
    resetJoinDraft,
    setGameError,
    setPlayerName,
    setSelectedAiDifficulty,
    setSelectedMaxCards,
    joinGameIdChanged,
    joinPlayerNameChanged,
  } = appActions
  const { awayContinue, bid, endOfRound, help, homeSession, lobbyPlayer, share } = useAppModalState()

  const handleJoinGameIdInputChange = (event) => joinGameIdChanged(event.target.value)
  const handleJoinPlayerNameInputChange = (event) => joinPlayerNameChanged(sanitizePlayerNameInput(event.target.value))
  const handleCreatePlayerNameInputChange = (event) => setPlayerName(sanitizePlayerNameInput(event.target.value))
  const handleCloseCreateModal = () => {
    homeSession.closeCreate()
    resetCreateDraft()
  }
  const handleCloseJoinModal = () => {
    homeSession.closeJoin()
    resetJoinDraft()
  }

  const openHomeSessionModal = (modalType) => {
    resetActiveSessionState()
    clearHomeRequestState()

    if (modalType === 'create') {
      resetCreateDraft()
      homeSession.openCreate()
      return
    }

    resetJoinDraft()
    homeSession.openJoin()
  }

  const handleRejoinSelectionChange = (event) => {
    const nextGameId = event.target.value
    const selectedGame = rejoinableGames.find((entry) => entry.gameId === nextGameId)
    rejoinSelectionChanged(nextGameId, selectedGame)
  }

  const lobby = useLobbyController({
    appState,
    appActions,
    applyRealtimeResult: (...args) => applyRealtimeResult(...args),
  })
  const {
    applyRealtimeResult,
    handleCopyShareLink,
    handleRemovedFromGame,
    isReactionOnCooldown,
    reactionCooldownTimeoutRef,
    requestActiveStateReview,
    resetActiveSessionState,
  } = useAppRuntime({
    appState,
    appActions,
    activeGame: lobby.activeGame,
    activeLobbySession: lobby.activeLobbySession,
    activeSessionKey: lobby.activeSessionKey,
    completedRoundCount: lobby.completedRoundCount,
    isLocalPlayerMarkedAway: lobby.isLocalPlayerMarkedAway,
    isOwnerLobby: lobby.isOwnerLobby,
    maxCardsForLobbySeatCount: lobby.maxCardsForLobbySeatCount,
    selectedMaxCards,
    shareLink: lobby.shareLink,
    isLobbyShareModalOpen: share.isLobbyOpen,
    reactionCooldownUntil,
    setIsEndOfRoundModalDismissed: endOfRound.setIsDismissed,
    setIsBidModalOpen: bid.setIsOpen,
    openJoinModal: homeSession.openJoin,
    closeJoinModal: homeSession.closeJoin,
    setShowAwayContinueModal: awayContinue.setIsOpen,
    setShareQrCodeDataUrl: share.setQrCodeDataUrl,
    setIsShareLinkCopied: share.setIsLinkCopied,
  })

  const handleOpenNewGame = () => openHomeSessionModal('create')
  const handleOpenJoinGame = () => openHomeSessionModal('join')

  const { handleCreateGame, handleJoinGame, handleRenamePlayer } = useSessionActions({
    appState,
    appActions,
    activeLobbyPlayerId: lobby.activeLobbyPlayerId,
    closeCreateModal: handleCloseCreateModal,
    closeJoinModal: handleCloseJoinModal,
    applyRealtimeResult,
  })
  const {
    handleContinueGame,
    handleCoverAwayPlayerTurn,
    handleDealCards,
    handleLeaveGame,
    handlePlayCard,
    handleSendReaction,
    handleStartOver,
    handleSubmitBid,
    openSubmitBidModal,
    toggleSortCards,
  } = useActiveGameController({
    appState,
    appActions,
    currentRoundCardCount: lobby.currentRoundCardCount,
    sortMode,
    selectedBid: bid.selectedBid,
    isReactionOnCooldown,
    requestActiveStateReview,
    applyRealtimeResult,
    handleRemovedFromGame,
    closeSubmitBidModal: bid.close,
    setSelectedBid: bid.setSelectedBid,
    setIsBidModalOpen: bid.setIsOpen,
    setShowAwayContinueModal: awayContinue.setIsOpen,
    reactionCooldownTimeoutRef,
  })

  const homeProps = buildHomeProps({
    buildTimestampLabel: '',
    canInstallApp: false,
    isStagingBuild: false,
    promptToInstall: () => {},
    requestError,
    sessionInfo,
  })

  const lobbyProps = buildLobbyProps({
    gameError,
    handleCopyShareLink,
    handleRenamePlayer,
    isRenamingPlayer,
    isShareLinkCopied: share.isLinkCopied,
    isStartingGame,
    lobby,
    lobbyInfo,
    openLobbyRemovePlayerConfirm: lobbyPlayer.openRemovePlayerConfirm,
    openLobbyRemoveSeatConfirm: lobbyPlayer.openRemoveSeatConfirm,
    openLobbyRenamePlayerModal: lobbyPlayer.openRenameModal,
    ownerSession,
    pendingPlayerActionId,
    resetActiveSessionState,
    selectedAiDifficulty,
    selectedMaxCards,
    setSelectedAiDifficulty,
    setSelectedMaxCards,
    shareQrCodeDataUrl: share.qrCodeDataUrl,
  })

  const activeGameProps = buildActiveGameProps({
    gameError,
    handleCopyShareLink,
    handleCoverAwayPlayerTurn,
    handleDealCards,
    handleLeaveGame,
    handleOpenJoinGame,
    handleOpenNewGame,
    handlePlayCard,
    handleRenamePlayer,
    handleSendReaction,
    handleStartOver,
    isDealingCards,
    isLeavingGame,
    isPlayingCard,
    isReactionOnCooldown,
    isSendingReaction,
    isShareLinkCopied: share.isLinkCopied,
    isSortingCards,
    isStartingOver,
    lobby,
    openHelpModal: help.open,
    openSubmitBidModal,
    ownerSession,
    pendingPlayerActionId,
    promptToInstall: () => {},
    resetActiveSessionState,
    setGameError,
    sortMode,
    toggleSortCards,
  })

  const modalProps = buildModalProps({
    closeHelpModal: help.close,
    closeLobbyRemovePlayerConfirm: lobbyPlayer.closeRemovePlayerConfirm,
    closeLobbyRemoveSeatConfirm: lobbyPlayer.closeRemoveSeatConfirm,
    closeLobbyRenamePlayerModal: lobbyPlayer.closeRenameModal,
    closeLobbyShareModal: share.closeLobby,
    closeSubmitBidModal: bid.close,
    createErrors,
    handleCloseCreateModal,
    handleCloseJoinModal,
    handleContinueGame,
    handleCreateGame,
    handleCreatePlayerNameInputChange,
    handleJoinGame,
    handleJoinGameIdInputChange,
    handleJoinPlayerNameInputChange,
    handleRejoinSelectionChange,
    handleSubmitBid,
    helpSection: help.section,
    isBidModalOpen: bid.isOpen,
    isContinuingGame,
    isCreateModalOpen: homeSession.isCreateOpen,
    isCreatingGame,
    isEndOfRoundModalDismissed: endOfRound.isDismissed,
    isHelpModalOpen: help.isOpen,
    isJoinModalOpen: homeSession.isJoinOpen,
    isJoiningGame,
    isLoadingRejoinGames,
    isLobbyShareModalOpen: share.isLobbyOpen,
    isRejoiningGame,
    isSubmittingBid,
    joinErrors,
    joinGameId,
    joinMenuCloseRequestKey,
    joinPlayerName,
    lobby,
    lobbyRenameDraft: lobbyPlayer.renameDraft,
    openCreateModal: homeSession.openCreate,
    openHelpModal: help.open,
    openJoinModal: homeSession.openJoin,
    openLobbyShareModal: share.openLobby,
    pendingLobbyRemovePlayer: lobbyPlayer.pendingRemovePlayer,
    pendingLobbyRemoveSeat: lobbyPlayer.pendingRemoveSeat,
    pendingLobbyRenamePlayer: lobbyPlayer.pendingRenamePlayer,
    persistedEndOfRoundSummary,
    playerName,
    rejoinableGames,
    resetCreateDraft,
    resetJoinDraft,
    selectedBid: bid.selectedBid,
    selectedRejoinGameId,
    setHelpSection: help.setSection,
    setIsEndOfRoundModalDismissed: endOfRound.setIsDismissed,
    setLobbyRenameDraft: lobbyPlayer.setRenameDraft,
    setSelectedBid: bid.setSelectedBid,
    showAwayContinueModal: awayContinue.isOpen,
  })

  return (
    <AppRoutes
      home={homeProps}
      lobby={lobbyProps}
      activeGame={activeGameProps}
      modals={modalProps}
    />
  )
}

test.beforeEach(() => {
  resetFakeBackend()
  window.localStorage.clear()
  window.history.pushState({}, '', '/')
  for (const fn of [
    createGameMock,
    startGameMock,
    dealCardsMock,
    submitBidMock,
    playCardMock,
    checkStateMock,
    subscribeToGameEventsMock,
    setActiveGameSessionMock,
  ]) {
    fn.mock.resetCalls()
  }
})

test.afterEach(() => {
  cleanup()
})

// The action bar (and its buttons) render twice -- once for desktop, once for the mobile
// layout -- so button lookups take the first match instead of asserting a single element.
const findButton = (name) => screen.getAllByRole('button', { name })[0]
const clickButton = (name) => fireEvent.click(findButton(name))
const waitForButton = (name, options) => waitFor(() => assert.ok(findButton(name)), options)

test('full session flow: create -> lobby -> start -> deal -> bid -> play -> game over', async () => {
  render(<TestApp />)

  clickButton('New Game')
  fireEvent.change(screen.getByPlaceholderText('Enter your name'), { target: { value: 'Casey' } })
  await act(async () => {
    clickButton('Create Game')
  })

  await waitForButton(/Start Game/)
  assert.equal(createGameMock.mock.calls.length, 1)
  assert.equal(createGameMock.mock.calls[0].arguments[0].playerName, 'Casey')

  fireEvent.change(screen.getByLabelText('Select max cards'), { target: { value: '1' } })

  await act(async () => {
    clickButton('Start Game')
  })

  await waitForButton(/Deal Cards/)
  assert.equal(startGameMock.mock.calls.length, 1)
  assert.equal(startGameMock.mock.calls[0].arguments[0].maxCards, 1)

  await act(async () => {
    clickButton('Deal Cards')
  })

  await waitForButton('Bid')
  assert.equal(dealCardsMock.mock.calls.length, 1)

  clickButton('Bid')
  await waitForButton('Submit')

  await act(async () => {
    clickButton('Submit')
  })

  await waitFor(() => assert.ok(screen.getAllByRole('button', { name: 'A of Hearts' })[0]))
  assert.equal(submitBidMock.mock.calls.length, 1)
  assert.equal(submitBidMock.mock.calls[0].arguments[0].bid, 0)

  fireEvent.click(screen.getAllByRole('button', { name: 'A of Hearts' })[0])
  await waitForButton('Play Card')

  await act(async () => {
    clickButton('Play Card')
  })

  assert.equal(playCardMock.mock.calls.length, 1)
  assert.deepEqual(playCardMock.mock.calls[0].arguments[0].card, { rank: 'A', suit: 'Hearts' })

  // The round-reveal delay (advanceAfter) is already due, so useAppRuntime's own polling
  // effect should call checkState and carry the game the rest of the way to GameOver.
  await waitFor(() => assert.ok(checkStateMock.mock.calls.length >= 1), { timeout: 2000 })
  await waitForButton('Start Over', { timeout: 2000 })

  assert.equal(fakeGame.phase.stage, 'GameOver')
})
