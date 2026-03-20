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
    closeCreateModal,
    closeHelpModal,
    closeJoinModal,
    closeLobbyRemovePlayerConfirm,
    closeLobbyRemoveSeatConfirm,
    closeLobbyRenamePlayerModal,
    closeLobbyShareModal,
    closeSubmitBidModal,
    helpSection,
    isBidModalOpen,
    isCreateModalOpen,
    isEndOfRoundModalDismissed,
    isHelpModalOpen,
    isJoinModalOpen,
    isLobbyShareModalOpen,
    isShareLinkCopied,
    lobbyRenameDraft,
    openCreateModal,
    openHelpModal,
    openJoinModal,
    openLobbyRemovePlayerConfirm,
    openLobbyRemoveSeatConfirm,
    openLobbyRenamePlayerModal,
    openLobbyShareModal,
    pendingLobbyRemovePlayer,
    pendingLobbyRemoveSeat,
    pendingLobbyRenamePlayer,
    selectedBid,
    setHelpSection,
    setIsBidModalOpen,
    setIsEndOfRoundModalDismissed,
    setIsShareLinkCopied,
    setLobbyRenameDraft,
    setSelectedBid,
    shareQrCodeDataUrl,
    setShareQrCodeDataUrl,
    setShowAwayContinueModal,
    showAwayContinueModal,
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
    closeCreateModal()
    resetCreateDraft()
  }

  const handleCloseJoinModal = () => {
    closeJoinModal()
    resetJoinDraft()
  }

  const openHomeSessionModal = (modalType) => {
    resetActiveSessionState()
    clearHomeRequestState()

    if (modalType === 'create') {
      resetCreateDraft()
      openCreateModal()
      return
    }

    resetJoinDraft()
    openJoinModal()
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
    isLobbyShareModalOpen,
    reactionCooldownUntil,
    setIsEndOfRoundModalDismissed,
    setIsBidModalOpen,
    openJoinModal,
    closeJoinModal,
    setShowAwayContinueModal,
    setShareQrCodeDataUrl,
    setIsShareLinkCopied,
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
    selectedBid,
    isReactionOnCooldown,
    requestActiveStateReview,
    applyRealtimeResult,
    handleRemovedFromGame,
    closeSubmitBidModal,
    setSelectedBid,
    setIsBidModalOpen,
    setShowAwayContinueModal,
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
    isShareLinkCopied,
    isStartingGame,
    lobby,
    lobbyInfo,
    openLobbyRemovePlayerConfirm,
    openLobbyRemoveSeatConfirm,
    openLobbyRenamePlayerModal,
    ownerSession,
    pendingPlayerActionId,
    resetActiveSessionState,
    selectedAiDifficulty,
    selectedMaxCards,
    setSelectedAiDifficulty,
    setSelectedMaxCards,
    shareQrCodeDataUrl,
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
    isShareLinkCopied,
    isSortingCards,
    isStartingOver,
    lobby,
    openHelpModal,
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
    closeHelpModal,
    closeLobbyRemovePlayerConfirm,
    closeLobbyRemoveSeatConfirm,
    closeLobbyRenamePlayerModal,
    closeLobbyShareModal,
    closeSubmitBidModal,
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
    helpSection,
    isBidModalOpen,
    isContinuingGame,
    isCreateModalOpen,
    isCreatingGame,
    isEndOfRoundModalDismissed,
    isHelpModalOpen,
    isJoinModalOpen,
    isJoiningGame,
    isLoadingRejoinGames,
    isLobbyShareModalOpen,
    isRejoiningGame,
    isSubmittingBid,
    joinErrors,
    joinGameId,
    joinMenuCloseRequestKey,
    joinPlayerName,
    lobby,
    lobbyRenameDraft,
    openCreateModal,
    openHelpModal,
    openJoinModal,
    openLobbyShareModal,
    pendingLobbyRemovePlayer,
    pendingLobbyRemoveSeat,
    pendingLobbyRenamePlayer,
    persistedEndOfRoundSummary,
    playerName,
    rejoinableGames,
    resetCreateDraft,
    resetJoinDraft,
    selectedBid,
    selectedRejoinGameId,
    setHelpSection,
    setIsEndOfRoundModalDismissed,
    setLobbyRenameDraft,
    setSelectedBid,
    showAwayContinueModal,
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
