import { HomeScreen, LobbyScreen, ActiveGameScreen } from './AppScreens'
import {
  AwayContinueModal,
  BidModal,
  ConfirmLobbyActionModal,
  EndOfRoundSummaryModal,
  HelpModal,
  LobbyShareModal,
  RenameLobbyPlayerModal,
} from './AppModals'
import { CreateGameModal, JoinGameModal } from './SessionModals'
import { DownloadIcon, GameTablePage, HelpIcon, LinkIcon, ShareIcon } from './GameTablePage'
import { getRoundDirectionArrow } from '../utils/gameUi'
import { getPlayerPresence } from '../utils/playerPresence'

function buildHelpModal({ isOpen, helpSection, setHelpSection, onClose }) {
  return (
    <HelpModal
      isOpen={isOpen}
      helpSection={helpSection}
      setHelpSection={setHelpSection}
      onClose={onClose}
    />
  )
}

function buildJoinGameModal({
  isOpen,
  joinGameId,
  joinPlayerName,
  joinErrors,
  rejoinableGames,
  selectedRejoinGameId,
  isLoadingRejoinGames,
  isJoiningGame,
  isRejoiningGame,
  onClose,
  onSubmit,
  onJoinGameIdChange,
  onJoinPlayerNameChange,
  onSelectedRejoinGameIdChange,
}) {
  return (
    <JoinGameModal
      isOpen={isOpen}
      joinGameId={joinGameId}
      joinPlayerName={joinPlayerName}
      joinErrors={joinErrors}
      rejoinableGames={rejoinableGames}
      selectedRejoinGameId={selectedRejoinGameId}
      isLoadingRejoinGames={isLoadingRejoinGames}
      isJoiningGame={isJoiningGame}
      isRejoiningGame={isRejoiningGame}
      onClose={onClose}
      onSubmit={onSubmit}
      onJoinGameIdChange={onJoinGameIdChange}
      onJoinPlayerNameChange={onJoinPlayerNameChange}
      onSelectedRejoinGameIdChange={onSelectedRejoinGameIdChange}
    />
  )
}

export function AppRoutes({
  isStagingBuild,
  buildTimestampLabel,
  requestError,
  sessionInfo,
  canInstallApp,
  promptToInstall,
  setIsHelpModalOpen,
  isHelpModalOpen,
  helpSection,
  setHelpSection,
  isCreateModalOpen,
  playerName,
  createErrors,
  isCreatingGame,
  closeCreateModal,
  handleCreateGame,
  setPlayerNameInput,
  isJoinModalOpen,
  joinGameId,
  joinPlayerName,
  joinErrors,
  rejoinableGames,
  selectedRejoinGameId,
  isLoadingRejoinGames,
  isJoiningGame,
  isRejoiningGame,
  closeJoinModal,
  handleJoinGame,
  handleJoinGameIdInputChange,
  handleJoinPlayerNameInputChange,
  handleRejoinSelectionChange,
  setIsCreateModalOpen,
  setIsJoinModalOpen,
  activeGame,
  ownerSession,
  gameError,
  lobbyInfo,
  activeLobbySession,
  orderedPlayers,
  currentDealerPlayerId,
  activeLobbyPlayerId,
  isOwnerLobby,
  isRenamingPlayer,
  isStartingGame,
  openLobbyRenamePlayerModal,
  pendingPlayerActionId,
  handleMovePlayer,
  openLobbyRemoveSeatConfirm,
  openLobbyRemovePlayerConfirm,
  handleAddSeat,
  maxSeats,
  maxCardsForLobbySeatCount,
  selectedMaxCards,
  setSelectedMaxCards,
  selectedAiDifficulty,
  setSelectedAiDifficulty,
  aiDifficultyOptions,
  resetActiveSessionState,
  handleStartGame,
  setIsLobbyShareModalOpen,
  isLobbyShareModalOpen,
  shareLink,
  isShareLinkCopied,
  shareQrCodeDataUrl,
  handleCopyShareLink,
  pendingLobbyRemovePlayer,
  pendingLobbyRemoveSeat,
  pendingLobbyRenamePlayer,
  lobbyRenameDraft,
  setLobbyRenameDraft,
  closeLobbyRemovePlayerConfirm,
  closeLobbyRemoveSeatConfirm,
  closeLobbyRenamePlayerModal,
  handleRemovePlayer,
  handleRemoveSeat,
  handleRenamePlayer,
  showAwayContinueModal,
  isLocalPlayerMarkedAway,
  isContinuingGame,
  handleContinueGame,
  isTripRound,
  currentRoundCardCount,
  selectedBid,
  setSelectedBid,
  isBidModalOpen,
  closeSubmitBidModal,
  handleSubmitBid,
  persistedEndOfRoundSummary,
  isEndOfRoundModalDismissed,
  setIsEndOfRoundModalDismissed,
  sortMode,
  onSetGameError,
  onRenamePlayer,
  onRemovePlayer,
  onCoverAwayPlayerTurn,
  onLeaveGame,
  onDealCards,
  onSubmitBid,
  onPlayCard,
  onSortCards,
  onStartOver,
  onSendReaction,
  onGoHome,
  onOpenHelp,
  onOpenNewGame,
  onOpenJoinGame,
  onInstallApp,
  isDealingCards,
  isStartingOver,
  isSubmittingBid,
  isPlayingCard,
  isSendingReaction,
  isReactionOnCooldown,
  isLeavingGame,
  isSortingCards,
  menuCloseRequestKey,
}) {
  const helpModal = buildHelpModal({
    isOpen: isHelpModalOpen,
    helpSection,
    setHelpSection,
    onClose: () => setIsHelpModalOpen(false),
  })
  const createGameModal = (
    <CreateGameModal
      isOpen={isCreateModalOpen}
      playerName={playerName}
      playerNameError={createErrors.playerName}
      isCreatingGame={isCreatingGame}
      onClose={closeCreateModal}
      onSubmit={handleCreateGame}
      onPlayerNameChange={setPlayerNameInput}
    />
  )
  const joinGameModal = buildJoinGameModal({
    isOpen: isJoinModalOpen,
    joinGameId,
    joinPlayerName,
    joinErrors,
    rejoinableGames,
    selectedRejoinGameId,
    isLoadingRejoinGames,
    isJoiningGame,
    isRejoiningGame,
    onClose: closeJoinModal,
    onSubmit: handleJoinGame,
    onJoinGameIdChange: handleJoinGameIdInputChange,
    onJoinPlayerNameChange: handleJoinPlayerNameInputChange,
    onSelectedRejoinGameIdChange: handleRejoinSelectionChange,
  })
  const awayContinueModal = (
    <AwayContinueModal
      isOpen={showAwayContinueModal && isLocalPlayerMarkedAway}
      isContinuingGame={isContinuingGame}
      onContinue={handleContinueGame}
    />
  )

  if (activeGame && activeGame.phase?.stage !== 'Lobby') {
    const gameTable = (
      <GameTablePage
        game={activeGame}
        isOwner={Boolean(ownerSession)}
        ownerPlayerId={ownerSession?.ownerPlayerId ?? ''}
        pendingPlayerActionId={pendingPlayerActionId}
        errorMessage={gameError}
        shareLink={shareLink}
        isShareLinkCopied={isShareLinkCopied}
        onCopyShareLink={handleCopyShareLink}
        onSetGameError={onSetGameError}
        onRenamePlayer={onRenamePlayer}
        onRemovePlayer={onRemovePlayer}
        onCoverAwayPlayerTurn={onCoverAwayPlayerTurn}
        onLeaveGame={onLeaveGame}
        onDealCards={onDealCards}
        onSubmitBid={onSubmitBid}
        onPlayCard={onPlayCard}
        onSortCards={onSortCards}
        sortMode={sortMode}
        onStartOver={onStartOver}
        onSendReaction={onSendReaction}
        onGoHome={resetActiveSessionState}
        onOpenHelp={onOpenHelp}
        onOpenNewGame={onOpenNewGame}
        onOpenJoinGame={onOpenJoinGame}
        onInstallApp={onInstallApp}
        canInstallApp={canInstallApp}
        isDealingCards={isDealingCards}
        isStartingOver={isStartingOver}
        isSubmittingBid={isSubmittingBid}
        isPlayingCard={isPlayingCard}
        isSendingReaction={isSendingReaction}
        isReactionOnCooldown={isReactionOnCooldown}
        isRenamingPlayer={isRenamingPlayer}
        isLeavingGame={isLeavingGame}
        isSortingCards={isSortingCards}
        isLoadingRejoinGames={isLoadingRejoinGames}
        menuCloseRequestKey={menuCloseRequestKey}
        isJoinModalOpen={isJoinModalOpen}
      />
    )
    const bidModal = (
      <BidModal
        isOpen={isBidModalOpen}
        currentRoundCardCount={currentRoundCardCount}
        isTripRound={isTripRound}
        selectedBid={selectedBid}
        setSelectedBid={setSelectedBid}
        isSubmittingBid={isSubmittingBid}
        onClose={closeSubmitBidModal}
        onSubmit={handleSubmitBid}
      />
    )
    const endOfRoundModal = (
      <EndOfRoundSummaryModal
        summary={persistedEndOfRoundSummary}
        isOpen={!isEndOfRoundModalDismissed}
        getRoundDirectionArrow={getRoundDirectionArrow}
        onClose={() => setIsEndOfRoundModalDismissed(true)}
      />
    )

    return (
      <ActiveGameScreen
        gameTable={gameTable}
        bidModal={bidModal}
        endOfRoundModal={endOfRoundModal}
        joinModal={joinGameModal}
        awayContinueModal={awayContinueModal}
        helpModal={helpModal}
      />
    )
  }

  if (activeLobbySession?.gameId && activeLobbySession?.game) {
    const shareModal = (
      <LobbyShareModal
        isOpen={isLobbyShareModalOpen}
        gameId={activeLobbySession.gameId}
        shareLink={shareLink}
        isShareLinkCopied={isShareLinkCopied}
        shareQrCodeDataUrl={shareQrCodeDataUrl}
        onCopyShareLink={handleCopyShareLink}
        onClose={() => setIsLobbyShareModalOpen(false)}
        LinkIcon={LinkIcon}
      />
    )
    const removePlayerModal = (
      <ConfirmLobbyActionModal
        isOpen={Boolean(pendingLobbyRemovePlayer)}
        title="Remove Player?"
        description={pendingLobbyRemovePlayer
          ? `Remove ${pendingLobbyRemovePlayer.name} from this game and return that seat to AI control?`
          : ''}
        confirmLabel="Remove Player"
        pendingLabel="Removing..."
        isPending={pendingPlayerActionId === pendingLobbyRemovePlayer?.id}
        onClose={closeLobbyRemovePlayerConfirm}
        onConfirm={async () => {
          const playerId = pendingLobbyRemovePlayer?.id
          if (!playerId) {
            return
          }

          const didRemove = await handleRemovePlayer(playerId)
          if (didRemove) {
            closeLobbyRemovePlayerConfirm()
          }
        }}
      />
    )
    const removeSeatModal = (
      <ConfirmLobbyActionModal
        isOpen={Boolean(pendingLobbyRemoveSeat)}
        title="Remove Seat?"
        description={pendingLobbyRemoveSeat
          ? `Remove the ${pendingLobbyRemoveSeat.name} seat from this lobby?`
          : ''}
        confirmLabel="Remove Seat"
        pendingLabel="Removing..."
        isPending={pendingPlayerActionId === pendingLobbyRemoveSeat?.id}
        onClose={closeLobbyRemoveSeatConfirm}
        onConfirm={async () => {
          const playerId = pendingLobbyRemoveSeat?.id
          if (!playerId) {
            return
          }

          const didRemove = await handleRemoveSeat(playerId)
          if (didRemove) {
            closeLobbyRemoveSeatConfirm()
          }
        }}
      />
    )
    const renamePlayerModal = (
      <RenameLobbyPlayerModal
        player={pendingLobbyRenamePlayer}
        draftValue={lobbyRenameDraft}
        setDraftValue={setLobbyRenameDraft}
        isRenamingPlayer={isRenamingPlayer}
        onClose={closeLobbyRenamePlayerModal}
        onSubmit={async (event) => {
          event.preventDefault()
          const nextName = lobbyRenameDraft.trim()
          if (!nextName || nextName === pendingLobbyRenamePlayer?.name) {
            closeLobbyRenamePlayerModal()
            return
          }

          const didRename = await handleRenamePlayer(
            nextName,
            pendingLobbyRenamePlayer.id,
          )
          if (didRename) {
            closeLobbyRenamePlayerModal()
          }
        }}
      />
    )

    return (
      <LobbyScreen
        activeLobbySession={activeLobbySession}
        gameError={gameError}
        lobbyInfo={lobbyInfo}
        orderedPlayers={orderedPlayers}
        currentDealerPlayerId={currentDealerPlayerId}
        activeLobbyPlayerId={activeLobbyPlayerId}
        isOwnerLobby={isOwnerLobby}
        ownerSession={ownerSession}
        isRenamingPlayer={isRenamingPlayer}
        isStartingGame={isStartingGame}
        openLobbyRenamePlayerModal={openLobbyRenamePlayerModal}
        pendingPlayerActionId={pendingPlayerActionId}
        handleMovePlayer={handleMovePlayer}
        openLobbyRemoveSeatConfirm={openLobbyRemoveSeatConfirm}
        openLobbyRemovePlayerConfirm={openLobbyRemovePlayerConfirm}
        handleAddSeat={handleAddSeat}
        maxSeats={maxSeats}
        maxCardsForLobbySeatCount={maxCardsForLobbySeatCount}
        selectedMaxCards={selectedMaxCards}
        setSelectedMaxCards={setSelectedMaxCards}
        selectedAiDifficulty={selectedAiDifficulty}
        setSelectedAiDifficulty={setSelectedAiDifficulty}
        aiDifficultyOptions={aiDifficultyOptions}
        resetActiveSessionState={resetActiveSessionState}
        handleStartGame={handleStartGame}
        setIsLobbyShareModalOpen={setIsLobbyShareModalOpen}
        getPlayerPresence={getPlayerPresence}
        shareIcon={ShareIcon}
        shareModal={shareModal}
        removePlayerModal={removePlayerModal}
        removeSeatModal={removeSeatModal}
        renamePlayerModal={renamePlayerModal}
        awayContinueModal={awayContinueModal}
        helpModal={helpModal}
      />
    )
  }

  return (
    <HomeScreen
      isStagingBuild={isStagingBuild}
      buildTimestampLabel={buildTimestampLabel}
      requestError={requestError}
      sessionInfo={sessionInfo}
      canInstallApp={canInstallApp}
      promptToInstall={promptToInstall}
      setIsHelpModalOpen={setIsHelpModalOpen}
      setIsCreateModalOpen={setIsCreateModalOpen}
      setIsJoinModalOpen={setIsJoinModalOpen}
      DownloadIcon={DownloadIcon}
      HelpIcon={HelpIcon}
      createGameModal={createGameModal}
      joinGameModal={joinGameModal}
      helpModal={helpModal}
    />
  )
}
