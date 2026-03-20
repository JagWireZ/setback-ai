import { useState } from 'react'
import { AppRoutes } from './components/AppRoutes'
import { useAppRuntime } from './hooks/useAppRuntime'
import { useAppModalState } from './hooks/useAppModalState'
import { useLobbyController } from './hooks/useLobbyController'
import { useActiveGameController } from './hooks/useActiveGameController'
import { useSessionActions } from './hooks/useSessionActions'
import { sanitizePlayerNameInput } from './utils/playerName'
import { usePwaInstall } from './utils/pwa'

const isStagingBuild = import.meta.env.VITE_APP_ENV === 'staging'
const buildTimestampLabel = typeof __BUILD_TIMESTAMP__ === 'string' ? __BUILD_TIMESTAMP__ : ''

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
    closeJoinModal,
    closeLobbyRemovePlayerConfirm,
    closeLobbyRemoveSeatConfirm,
    closeLobbyRenamePlayerModal,
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
    openLobbyRemovePlayerConfirm,
    openLobbyRemoveSeatConfirm,
    openLobbyRenamePlayerModal,
    pendingLobbyRemovePlayer,
    pendingLobbyRemoveSeat,
    pendingLobbyRenamePlayer,
    selectedBid,
    setHelpSection,
    setIsBidModalOpen,
    setIsCreateModalOpen,
    setIsEndOfRoundModalDismissed,
    setIsHelpModalOpen,
    setIsJoinModalOpen,
    setIsLobbyShareModalOpen,
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
    setIsJoinModalOpen,
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
    resetActiveSessionState()
    setRequestError('')
    setSessionInfo(null)
    setIsJoinModalOpen(false)
    setIsCreateModalOpen(true)
  }

  const handleOpenJoinGame = () => {
    resetActiveSessionState()
    setRequestError('')
    setSessionInfo(null)
    setIsCreateModalOpen(false)
    setIsJoinModalOpen(true)
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

  return (
    <AppRoutes
      isStagingBuild={isStagingBuild}
      buildTimestampLabel={buildTimestampLabel}
      requestError={requestError}
      sessionInfo={sessionInfo}
      canInstallApp={canInstallApp}
      promptToInstall={promptToInstall}
      setIsHelpModalOpen={setIsHelpModalOpen}
      isHelpModalOpen={isHelpModalOpen}
      helpSection={helpSection}
      setHelpSection={setHelpSection}
      isCreateModalOpen={isCreateModalOpen}
      playerName={playerName}
      createErrors={createErrors}
      isCreatingGame={isCreatingGame}
      closeCreateModal={handleCloseCreateModal}
      handleCreateGame={handleCreateGame}
      setPlayerNameInput={handleCreatePlayerNameInputChange}
      isJoinModalOpen={isJoinModalOpen}
      joinGameId={joinGameId}
      joinPlayerName={joinPlayerName}
      joinErrors={joinErrors}
      rejoinableGames={rejoinableGames}
      selectedRejoinGameId={selectedRejoinGameId}
      isLoadingRejoinGames={isLoadingRejoinGames}
      isJoiningGame={isJoiningGame}
      isRejoiningGame={isRejoiningGame}
      closeJoinModal={handleCloseJoinModal}
      handleJoinGame={handleJoinGame}
      handleJoinGameIdInputChange={handleJoinGameIdInputChange}
      handleJoinPlayerNameInputChange={handleJoinPlayerNameInputChange}
      handleRejoinSelectionChange={handleRejoinSelectionChange}
      setIsCreateModalOpen={setIsCreateModalOpen}
      setIsJoinModalOpen={setIsJoinModalOpen}
      activeGame={lobby.activeGame}
      ownerSession={ownerSession}
      gameError={gameError}
      lobbyInfo={lobbyInfo}
      activeLobbySession={lobby.activeLobbySession}
      orderedPlayers={lobby.orderedPlayers}
      currentDealerPlayerId={lobby.currentDealerPlayerId}
      activeLobbyPlayerId={lobby.activeLobbyPlayerId}
      isOwnerLobby={lobby.isOwnerLobby}
      isRenamingPlayer={isRenamingPlayer}
      isStartingGame={isStartingGame}
      openLobbyRenamePlayerModal={openLobbyRenamePlayerModal}
      pendingPlayerActionId={pendingPlayerActionId}
      handleMovePlayer={lobby.handleMovePlayer}
      openLobbyRemoveSeatConfirm={openLobbyRemoveSeatConfirm}
      openLobbyRemovePlayerConfirm={openLobbyRemovePlayerConfirm}
      handleAddSeat={lobby.handleAddSeat}
      maxSeats={lobby.maxSeats}
      maxCardsForLobbySeatCount={lobby.maxCardsForLobbySeatCount}
      selectedMaxCards={selectedMaxCards}
      setSelectedMaxCards={setSelectedMaxCards}
      selectedAiDifficulty={selectedAiDifficulty}
      setSelectedAiDifficulty={setSelectedAiDifficulty}
      aiDifficultyOptions={lobby.aiDifficultyOptions}
      resetActiveSessionState={resetActiveSessionState}
      handleStartGame={lobby.handleStartGame}
      setIsLobbyShareModalOpen={setIsLobbyShareModalOpen}
      isLobbyShareModalOpen={isLobbyShareModalOpen}
      shareLink={lobby.shareLink}
      isShareLinkCopied={isShareLinkCopied}
      shareQrCodeDataUrl={shareQrCodeDataUrl}
      handleCopyShareLink={handleCopyShareLink}
      pendingLobbyRemovePlayer={pendingLobbyRemovePlayer}
      pendingLobbyRemoveSeat={pendingLobbyRemoveSeat}
      pendingLobbyRenamePlayer={pendingLobbyRenamePlayer}
      lobbyRenameDraft={lobbyRenameDraft}
      setLobbyRenameDraft={setLobbyRenameDraft}
      closeLobbyRemovePlayerConfirm={closeLobbyRemovePlayerConfirm}
      closeLobbyRemoveSeatConfirm={closeLobbyRemoveSeatConfirm}
      closeLobbyRenamePlayerModal={closeLobbyRenamePlayerModal}
      handleRemovePlayer={lobby.handleRemovePlayer}
      handleRemoveSeat={lobby.handleRemoveSeat}
      handleRenamePlayer={handleRenamePlayer}
      showAwayContinueModal={showAwayContinueModal}
      isLocalPlayerMarkedAway={lobby.isLocalPlayerMarkedAway}
      isContinuingGame={isContinuingGame}
      handleContinueGame={handleContinueGame}
      isTripRound={lobby.isTripRound}
      currentRoundCardCount={lobby.currentRoundCardCount}
      selectedBid={selectedBid}
      setSelectedBid={setSelectedBid}
      isBidModalOpen={isBidModalOpen}
      closeSubmitBidModal={closeSubmitBidModal}
      handleSubmitBid={handleSubmitBid}
      persistedEndOfRoundSummary={persistedEndOfRoundSummary}
      isEndOfRoundModalDismissed={isEndOfRoundModalDismissed}
      setIsEndOfRoundModalDismissed={setIsEndOfRoundModalDismissed}
      sortMode={sortMode}
      onSetGameError={setGameError}
      onRenamePlayer={handleRenamePlayer}
      onRemovePlayer={handleRemovePlayer}
      onCoverAwayPlayerTurn={handleCoverAwayPlayerTurn}
      onLeaveGame={handleLeaveGame}
      onDealCards={handleDealCards}
      onSubmitBid={openSubmitBidModal}
      onPlayCard={handlePlayCard}
      onSortCards={toggleSortCards}
      onStartOver={handleStartOver}
      onSendReaction={handleSendReaction}
      onGoHome={resetActiveSessionState}
      onOpenHelp={() => setIsHelpModalOpen(true)}
      onOpenNewGame={handleOpenNewGame}
      onOpenJoinGame={handleOpenJoinGame}
      onInstallApp={promptToInstall}
      isDealingCards={isDealingCards}
      isStartingOver={isStartingOver}
      isSubmittingBid={isSubmittingBid}
      isPlayingCard={isPlayingCard}
      isSendingReaction={isSendingReaction}
      isReactionOnCooldown={isReactionOnCooldown}
      isLeavingGame={isLeavingGame}
      isSortingCards={isSortingCards}
      menuCloseRequestKey={joinMenuCloseRequestKey}
    />
  )
}
