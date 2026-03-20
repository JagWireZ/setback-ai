import { AppRoutes } from './components/AppRoutes'
import { useAppRuntime } from './hooks/useAppRuntime'
import { useAppModalState } from './hooks/useAppModalState'
import { useLobbyController } from './hooks/useLobbyController'
import { useActiveGameController } from './hooks/useActiveGameController'
import { useSessionActions } from './hooks/useSessionActions'
import { useAppState } from './hooks/useAppState'
import { buildTimestampLabel, isStagingBuild } from './config/appConfig'
import { sanitizePlayerNameInput } from './utils/playerName'
import { usePwaInstall } from './utils/pwa'

export default function App() {
  const { canInstall: canInstallApp, promptToInstall } = usePwaInstall()
  const { appState, appActions } = useAppState()
  const {
    createErrors,
    gameError,
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
    joinErrors,
    joinGameId,
    joinMenuCloseRequestKey,
    joinPlayerName,
    lobbyInfo,
    ownerSession,
    pendingPlayerActionId,
    persistedEndOfRoundSummary,
    playerName,
    playerSession,
    reactionCooldownUntil,
    rejoinableGames,
    requestError,
    selectedAiDifficulty,
    selectedMaxCards,
    selectedRejoinGameId,
    sessionInfo,
    sortMode,
  } = appState
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

  const homeProps = {
    isStagingBuild,
    buildTimestampLabel,
    requestError,
    sessionInfo,
    canInstallApp,
    promptToInstall,
  }

  const lobbyProps = {
    activeLobbySession: lobby.activeLobbySession,
    orderedPlayers: lobby.orderedPlayers,
    currentDealerPlayerId: lobby.currentDealerPlayerId,
    activeLobbyPlayerId: lobby.activeLobbyPlayerId,
    isOwnerLobby: lobby.isOwnerLobby,
    isLocalPlayerMarkedAway: lobby.isLocalPlayerMarkedAway,
    isRenamingPlayer,
    isStartingGame,
    pendingPlayerActionId,
    maxSeats: lobby.maxSeats,
    maxCardsForLobbySeatCount: lobby.maxCardsForLobbySeatCount,
    selectedMaxCards,
    setSelectedMaxCards,
    selectedAiDifficulty,
    setSelectedAiDifficulty,
    aiDifficultyOptions: lobby.aiDifficultyOptions,
    shareLink: lobby.shareLink,
    isShareLinkCopied,
    shareQrCodeDataUrl,
    handleCopyShareLink,
    handleMovePlayer: lobby.handleMovePlayer,
    openLobbyRenamePlayerModal,
    openLobbyRemoveSeatConfirm,
    openLobbyRemovePlayerConfirm,
    handleAddSeat: lobby.handleAddSeat,
    handleStartGame: lobby.handleStartGame,
    handleRemovePlayer: lobby.handleRemovePlayer,
    handleRemoveSeat: lobby.handleRemoveSeat,
    handleRenamePlayer,
    resetActiveSessionState,
    gameError,
    lobbyInfo,
    ownerSession,
  }

  const activeGameProps = {
    game: lobby.activeGame,
    isOwner: Boolean(ownerSession),
    ownerPlayerId: ownerSession?.ownerPlayerId ?? '',
    pendingPlayerActionId,
    errorMessage: gameError,
    shareLink: lobby.shareLink,
    isShareLinkCopied,
    onCopyShareLink: handleCopyShareLink,
    onSetGameError: setGameError,
    onRenamePlayer: handleRenamePlayer,
    onRemovePlayer: lobby.handleRemovePlayer,
    onCoverAwayPlayerTurn: handleCoverAwayPlayerTurn,
    onLeaveGame: handleLeaveGame,
    onDealCards: handleDealCards,
    onSubmitBid: openSubmitBidModal,
    onPlayCard: handlePlayCard,
    onSortCards: toggleSortCards,
    sortMode,
    onStartOver: handleStartOver,
    onSendReaction: handleSendReaction,
    onGoHome: resetActiveSessionState,
    onOpenHelp: openHelpModal,
    onOpenNewGame: handleOpenNewGame,
    onOpenJoinGame: handleOpenJoinGame,
    onInstallApp: promptToInstall,
    isDealingCards,
    isStartingOver,
    isPlayingCard,
    isSendingReaction,
    isReactionOnCooldown,
    isLeavingGame,
    isSortingCards,
    isLocalPlayerMarkedAway: lobby.isLocalPlayerMarkedAway,
  }

  const modalProps = {
    help: {
      isOpen: isHelpModalOpen,
      helpSection,
      setHelpSection,
      onClose: closeHelpModal,
      onOpen: openHelpModal,
    },
    createGame: {
      isOpen: isCreateModalOpen,
      form: {
        playerName,
        playerNameError: createErrors.playerName,
        isCreatingGame,
        onPlayerNameChange: handleCreatePlayerNameInputChange,
      },
      onClose: handleCloseCreateModal,
      onSubmit: handleCreateGame,
      onOpen: () => {
        resetCreateDraft()
        openCreateModal()
      },
    },
    joinGame: {
      isOpen: isJoinModalOpen,
      form: {
        joinGameId,
        joinPlayerName,
        joinErrors,
        rejoinableGames,
        selectedRejoinGameId,
        isLoadingRejoinGames,
        isJoiningGame,
        isRejoiningGame,
        onJoinGameIdChange: handleJoinGameIdInputChange,
        onJoinPlayerNameChange: handleJoinPlayerNameInputChange,
        onSelectedRejoinGameIdChange: handleRejoinSelectionChange,
      },
      onClose: handleCloseJoinModal,
      onSubmit: handleJoinGame,
      onOpen: () => {
        resetJoinDraft()
        openJoinModal()
      },
      menuCloseRequestKey: joinMenuCloseRequestKey,
    },
    lobbyShare: {
      isOpen: isLobbyShareModalOpen,
      onClose: closeLobbyShareModal,
      onOpen: openLobbyShareModal,
    },
    lobbyRemovePlayer: {
      pendingPlayer: pendingLobbyRemovePlayer,
      onClose: closeLobbyRemovePlayerConfirm,
    },
    lobbyRemoveSeat: {
      pendingPlayer: pendingLobbyRemoveSeat,
      onClose: closeLobbyRemoveSeatConfirm,
    },
    lobbyRenamePlayer: {
      pendingPlayer: pendingLobbyRenamePlayer,
      draftValue: lobbyRenameDraft,
      setDraftValue: setLobbyRenameDraft,
      onClose: closeLobbyRenamePlayerModal,
    },
    awayContinue: {
      isOpen: showAwayContinueModal,
      isContinuingGame,
      onContinue: handleContinueGame,
    },
    bid: {
      isOpen: isBidModalOpen,
      currentRoundCardCount: lobby.currentRoundCardCount,
      isTripRound: lobby.isTripRound,
      selectedBid,
      setSelectedBid,
      isSubmittingBid,
      onClose: closeSubmitBidModal,
      onSubmit: handleSubmitBid,
    },
    endOfRound: {
      summary: persistedEndOfRoundSummary,
      isDismissed: isEndOfRoundModalDismissed,
      onClose: () => setIsEndOfRoundModalDismissed(true),
    },
  }

  return (
    <AppRoutes
      home={homeProps}
      lobby={lobbyProps}
      activeGame={activeGameProps}
      modals={modalProps}
    />
  )
}
