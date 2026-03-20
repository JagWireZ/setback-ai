import { AppRoutes } from './components/AppRoutes'
import { useAppRuntime } from './hooks/useAppRuntime'
import { useAppModalState } from './hooks/useAppModalState'
import { useLobbyController } from './hooks/useLobbyController'
import { useActiveGameController } from './hooks/useActiveGameController'
import { useSessionActions } from './hooks/useSessionActions'
import { useAppState } from './hooks/useAppState'
import { buildTimestampLabel, isStagingBuild } from './config/appConfig'
import {
  buildActiveGameProps,
  buildHomeProps,
  buildLobbyProps,
  buildModalProps,
} from './utils/appRouteProps'
import { sanitizePlayerNameInput } from './utils/playerName'
import { usePwaInstall } from './utils/pwa'

export default function App() {
  const { canInstall: canInstallApp, promptToInstall } = usePwaInstall()
  const { appState, appActions } = useAppState()
  const {
    home,
    session,
    game,
    requests,
  } = appState
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
  const {
    ownerSession,
    playerSession,
  } = session
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
  const {
    awayContinue,
    bid,
    endOfRound,
    help,
    homeSession,
    lobbyPlayer,
    share,
  } = useAppModalState()

  const handleJoinGameIdInputChange = (event) => {
    joinGameIdChanged(event.target.value)
  }

  const handleJoinPlayerNameInputChange = (event) => {
    joinPlayerNameChanged(sanitizePlayerNameInput(event.target.value))
  }

  const handleCreatePlayerNameInputChange = (event) => {
    setPlayerName(sanitizePlayerNameInput(event.target.value))
  }

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
    const selectedGame = rejoinableGames.find((game) => game.gameId === nextGameId)

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

  const handleOpenNewGame = () => {
    openHomeSessionModal('create')
  }

  const handleOpenJoinGame = () => {
    openHomeSessionModal('join')
  }

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
    buildTimestampLabel,
    canInstallApp,
    isStagingBuild,
    promptToInstall,
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
    promptToInstall,
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
