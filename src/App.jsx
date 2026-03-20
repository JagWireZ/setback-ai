import { useState } from 'react'
import { AppRoutes } from './components/AppRoutes'
import { useAppRuntime } from './hooks/useAppRuntime'
import { useAppModalState } from './hooks/useAppModalState'
import { useLobbyController } from './hooks/useLobbyController'
import { useActiveGameController } from './hooks/useActiveGameController'
import { useSessionActions } from './hooks/useSessionActions'
import { buildTimestampLabel, isStagingBuild } from './config/appConfig'
import { sanitizePlayerNameInput } from './utils/playerName'
import { usePwaInstall } from './utils/pwa'

export default function App() {
  const { canInstall: canInstallApp, promptToInstall } = usePwaInstall()
  const [playerName, setPlayerName] = useState('')
  const [selectedMaxCards, setSelectedMaxCards] = useState('10')
  const [selectedAiDifficulty, setSelectedAiDifficulty] = useState('medium')
  const [joinGameId, setJoinGameId] = useState('')
  const [selectedRejoinGameId, setSelectedRejoinGameId] = useState('')
  const [joinPlayerName, setJoinPlayerName] = useState('')
  const [createErrors, setCreateErrors] = useState({})
  const [joinErrors, setJoinErrors] = useState({})
  const [isCreatingGame, setIsCreatingGame] = useState(false)
  const [isJoiningGame, setIsJoiningGame] = useState(false)
  const [isRejoiningGame, setIsRejoiningGame] = useState(false)
  const [isLoadingRejoinGames, setIsLoadingRejoinGames] = useState(false)
  const [joinMenuCloseRequestKey, setJoinMenuCloseRequestKey] = useState(0)
  const [requestError, setRequestError] = useState('')
  const [sessionInfo, setSessionInfo] = useState(null)
  const [rejoinableGames, setRejoinableGames] = useState([])
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

  const [ownerSession, setOwnerSession] = useState(null)
  const [playerSession, setPlayerSession] = useState(null)
  const [gameError, setGameError] = useState('')
  const [lobbyInfo, setLobbyInfo] = useState('')
  const [isStartingGame, setIsStartingGame] = useState(false)
  const [isDealingCards, setIsDealingCards] = useState(false)
  const [sortMode, setSortMode] = useState('bySuit')
  const [isSubmittingBid, setIsSubmittingBid] = useState(false)
  const [isPlayingCard, setIsPlayingCard] = useState(false)
  const [isSendingReaction, setIsSendingReaction] = useState(false)
  const [isRenamingPlayer, setIsRenamingPlayer] = useState(false)
  const [isSortingCards, setIsSortingCards] = useState(false)
  const [isContinuingGame, setIsContinuingGame] = useState(false)
  const [isLeavingGame, setIsLeavingGame] = useState(false)
  const [isStartingOver, setIsStartingOver] = useState(false)
  const [persistedEndOfRoundSummary, setPersistedEndOfRoundSummary] = useState(null)
  const [pendingPlayerActionId, setPendingPlayerActionId] = useState('')
  const [reactionCooldownUntil, setReactionCooldownUntil] = useState(0)

  const handleJoinGameIdInputChange = (event) => {
    setJoinGameId(event.target.value)
    setJoinErrors((prev) => ({ ...prev, gameId: undefined }))
  }

  const handleJoinPlayerNameInputChange = (event) => {
    setJoinPlayerName(sanitizePlayerNameInput(event.target.value))
    setJoinErrors((prev) => ({ ...prev, playerName: undefined }))
  }

  const handleCreatePlayerNameInputChange = (event) => {
    setPlayerName(sanitizePlayerNameInput(event.target.value))
    setCreateErrors((prev) => ({ ...prev, playerName: undefined }))
  }

  const handleCloseCreateModal = () => {
    closeCreateModal()
    setPlayerName('')
    setCreateErrors({})
  }

  const handleCloseJoinModal = () => {
    closeJoinModal()
    setSelectedRejoinGameId('')
    setJoinGameId('')
    setJoinPlayerName('')
    setJoinErrors({})
  }

  const clearHomeRequestState = () => {
    setRequestError('')
    setSessionInfo(null)
  }

  const resetCreateDraft = () => {
    setPlayerName('')
    setCreateErrors({})
  }

  const resetJoinDraft = () => {
    setSelectedRejoinGameId('')
    setJoinGameId('')
    setJoinPlayerName('')
    setJoinErrors({})
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

    setSelectedRejoinGameId(nextGameId)

    if (nextGameId) {
      setJoinGameId(nextGameId)
      setJoinPlayerName(selectedGame?.playerName ?? '')
      setJoinErrors((prev) => ({ ...prev, gameId: undefined, playerName: undefined }))
      setJoinMenuCloseRequestKey((current) => current + 1)
      return
    }

    setJoinGameId('')
    setJoinPlayerName('')
  }

  const lobby = useLobbyController({
    ownerSession,
    playerSession,
    selectedMaxCards,
    selectedAiDifficulty,
    setPendingPlayerActionId,
    setGameError,
    setLobbyInfo,
    setIsStartingGame,
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
    ownerSession,
    playerSession,
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
    gameError,
    reactionCooldownUntil,
    setOwnerSession,
    setPlayerSession,
    setGameError,
    setLobbyInfo,
    setPersistedEndOfRoundSummary,
    setIsEndOfRoundModalDismissed,
    setIsBidModalOpen,
    setSessionInfo,
    setRequestError,
    openJoinModal,
    closeJoinModal,
    setRejoinableGames,
    setSelectedRejoinGameId,
    setIsLoadingRejoinGames,
    setJoinGameId,
    setSelectedMaxCards,
    setSelectedAiDifficulty,
    setShowAwayContinueModal,
    setShareQrCodeDataUrl,
    setSortMode,
    setIsShareLinkCopied,
  })

  const handleOpenNewGame = () => {
    openHomeSessionModal('create')
  }

  const handleOpenJoinGame = () => {
    openHomeSessionModal('join')
  }

  const { handleCreateGame, handleJoinGame, handleRenamePlayer } = useSessionActions({
    playerName,
    joinGameId,
    selectedRejoinGameId,
    joinPlayerName,
    rejoinableGames,
    ownerSession,
    playerSession,
    activeLobbyPlayerId: lobby.activeLobbyPlayerId,
    closeCreateModal: handleCloseCreateModal,
    closeJoinModal: handleCloseJoinModal,
    setCreateErrors,
    setJoinErrors,
    setRequestError,
    setIsCreatingGame,
    setSessionInfo,
    setOwnerSession,
    setSelectedMaxCards,
    setSelectedAiDifficulty,
    setPlayerSession,
    setGameError,
    setLobbyInfo,
    setIsJoiningGame,
    setIsRejoiningGame,
    setIsRenamingPlayer,
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
    ownerSession,
    playerSession,
    currentRoundCardCount: lobby.currentRoundCardCount,
    sortMode,
    selectedBid,
    isReactionOnCooldown,
    requestActiveStateReview,
    applyRealtimeResult,
    handleRemovedFromGame,
    closeSubmitBidModal,
    setRequestError,
    setSessionInfo,
    setSelectedMaxCards,
    setSelectedAiDifficulty,
    setGameError,
    setLobbyInfo,
    setIsLeavingGame,
    setIsStartingOver,
    setIsDealingCards,
    setSortMode,
    setSelectedBid,
    setIsBidModalOpen,
    setIsSubmittingBid,
    setIsSortingCards,
    setShowAwayContinueModal,
    setIsContinuingGame,
    setIsSendingReaction,
    setReactionCooldownUntil,
    reactionCooldownTimeoutRef,
    setIsPlayingCard,
    setPendingPlayerActionId,
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
