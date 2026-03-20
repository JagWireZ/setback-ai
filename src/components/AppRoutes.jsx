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

function buildHelpModal(help) {
  return (
    <HelpModal
      isOpen={help.isOpen}
      helpSection={help.helpSection}
      setHelpSection={help.setHelpSection}
      onClose={help.onClose}
    />
  )
}

function buildJoinGameModal({ isOpen, form, onClose, onSubmit }) {
  return (
    <JoinGameModal
      isOpen={isOpen}
      form={form}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  )
}

export function AppRoutes({ home, lobby, activeGame, modals }) {
  const helpModal = buildHelpModal(modals.help)
  const createGameModal = (
    <CreateGameModal
      isOpen={modals.createGame.isOpen}
      form={modals.createGame.form}
      onClose={modals.createGame.onClose}
      onSubmit={modals.createGame.onSubmit}
    />
  )
  const joinGameModal = buildJoinGameModal(modals.joinGame)
  const awayContinueModal = (
    <AwayContinueModal
      isOpen={modals.awayContinue.isOpen && activeGame.isLocalPlayerMarkedAway}
      isContinuingGame={modals.awayContinue.isContinuingGame}
      onContinue={modals.awayContinue.onContinue}
    />
  )

  if (activeGame.game && activeGame.game.phase?.stage !== 'Lobby') {
    const gameTable = (
      <GameTablePage
        game={activeGame.game}
        isOwner={activeGame.isOwner}
        ownerPlayerId={activeGame.ownerPlayerId}
        pendingPlayerActionId={activeGame.pendingPlayerActionId}
        errorMessage={activeGame.errorMessage}
        shareLink={activeGame.shareLink}
        isShareLinkCopied={activeGame.isShareLinkCopied}
        onCopyShareLink={activeGame.onCopyShareLink}
        onSetGameError={activeGame.onSetGameError}
        onRenamePlayer={activeGame.onRenamePlayer}
        onRemovePlayer={activeGame.onRemovePlayer}
        onCoverAwayPlayerTurn={activeGame.onCoverAwayPlayerTurn}
        onLeaveGame={activeGame.onLeaveGame}
        onDealCards={activeGame.onDealCards}
        onSubmitBid={activeGame.onSubmitBid}
        onPlayCard={activeGame.onPlayCard}
        onSortCards={activeGame.onSortCards}
        sortMode={activeGame.sortMode}
        onStartOver={activeGame.onStartOver}
        onSendReaction={activeGame.onSendReaction}
        onGoHome={activeGame.onGoHome}
        onOpenHelp={activeGame.onOpenHelp}
        onOpenNewGame={activeGame.onOpenNewGame}
        onOpenJoinGame={activeGame.onOpenJoinGame}
        onInstallApp={activeGame.onInstallApp}
        canInstallApp={home.canInstallApp}
        isDealingCards={activeGame.isDealingCards}
        isStartingOver={activeGame.isStartingOver}
        isSubmittingBid={modals.bid.isSubmittingBid}
        isPlayingCard={activeGame.isPlayingCard}
        isSendingReaction={activeGame.isSendingReaction}
        isReactionOnCooldown={activeGame.isReactionOnCooldown}
        isRenamingPlayer={lobby.isRenamingPlayer}
        isLeavingGame={activeGame.isLeavingGame}
        isSortingCards={activeGame.isSortingCards}
        isLoadingRejoinGames={modals.joinGame.form.isLoadingRejoinGames}
        menuCloseRequestKey={modals.joinGame.menuCloseRequestKey}
        isJoinModalOpen={modals.joinGame.isOpen}
      />
    )
    const bidModal = (
      <BidModal
        isOpen={modals.bid.isOpen}
        currentRoundCardCount={modals.bid.currentRoundCardCount}
        isTripRound={modals.bid.isTripRound}
        selectedBid={modals.bid.selectedBid}
        setSelectedBid={modals.bid.setSelectedBid}
        isSubmittingBid={modals.bid.isSubmittingBid}
        onClose={modals.bid.onClose}
        onSubmit={modals.bid.onSubmit}
      />
    )
    const endOfRoundModal = (
      <EndOfRoundSummaryModal
        summary={modals.endOfRound.summary}
        isOpen={!modals.endOfRound.isDismissed}
        getRoundDirectionArrow={getRoundDirectionArrow}
        onClose={modals.endOfRound.onClose}
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

  if (lobby.activeLobbySession?.gameId && lobby.activeLobbySession?.game) {
    const shareModal = (
      <LobbyShareModal
        isOpen={modals.lobbyShare.isOpen}
        gameId={lobby.activeLobbySession.gameId}
        shareLink={lobby.shareLink}
        isShareLinkCopied={lobby.isShareLinkCopied}
        shareQrCodeDataUrl={lobby.shareQrCodeDataUrl}
        onCopyShareLink={lobby.handleCopyShareLink}
        onClose={modals.lobbyShare.onClose}
        LinkIcon={LinkIcon}
      />
    )
    const removePlayerModal = (
      <ConfirmLobbyActionModal
        isOpen={Boolean(modals.lobbyRemovePlayer.pendingPlayer)}
        title="Remove Player?"
        description={modals.lobbyRemovePlayer.pendingPlayer
          ? `Remove ${modals.lobbyRemovePlayer.pendingPlayer.name} from this game and return that seat to AI control?`
          : ''}
        confirmLabel="Remove Player"
        pendingLabel="Removing..."
        isPending={lobby.pendingPlayerActionId === modals.lobbyRemovePlayer.pendingPlayer?.id}
        onClose={modals.lobbyRemovePlayer.onClose}
        onConfirm={async () => {
          const playerId = modals.lobbyRemovePlayer.pendingPlayer?.id
          if (!playerId) {
            return
          }

          const didRemove = await lobby.handleRemovePlayer(playerId)
          if (didRemove) {
            modals.lobbyRemovePlayer.onClose()
          }
        }}
      />
    )
    const removeSeatModal = (
      <ConfirmLobbyActionModal
        isOpen={Boolean(modals.lobbyRemoveSeat.pendingPlayer)}
        title="Remove Seat?"
        description={modals.lobbyRemoveSeat.pendingPlayer
          ? `Remove the ${modals.lobbyRemoveSeat.pendingPlayer.name} seat from this lobby?`
          : ''}
        confirmLabel="Remove Seat"
        pendingLabel="Removing..."
        isPending={lobby.pendingPlayerActionId === modals.lobbyRemoveSeat.pendingPlayer?.id}
        onClose={modals.lobbyRemoveSeat.onClose}
        onConfirm={async () => {
          const playerId = modals.lobbyRemoveSeat.pendingPlayer?.id
          if (!playerId) {
            return
          }

          const didRemove = await lobby.handleRemoveSeat(playerId)
          if (didRemove) {
            modals.lobbyRemoveSeat.onClose()
          }
        }}
      />
    )
    const renamePlayerModal = (
      <RenameLobbyPlayerModal
        player={modals.lobbyRenamePlayer.pendingPlayer}
        draftValue={modals.lobbyRenamePlayer.draftValue}
        setDraftValue={modals.lobbyRenamePlayer.setDraftValue}
        isRenamingPlayer={lobby.isRenamingPlayer}
        onClose={modals.lobbyRenamePlayer.onClose}
        onSubmit={async (event) => {
          event.preventDefault()
          const nextName = modals.lobbyRenamePlayer.draftValue.trim()
          if (!nextName || nextName === modals.lobbyRenamePlayer.pendingPlayer?.name) {
            modals.lobbyRenamePlayer.onClose()
            return
          }

          const didRename = await lobby.handleRenamePlayer(
            nextName,
            modals.lobbyRenamePlayer.pendingPlayer.id,
          )
          if (didRename) {
            modals.lobbyRenamePlayer.onClose()
          }
        }}
      />
    )

    return (
      <LobbyScreen
        lobby={{
          ...lobby,
          openShareModal: modals.lobbyShare.onOpen,
          getPlayerPresence,
          ShareIcon,
        }}
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
      home={{
        ...home,
        openHelp: modals.help.onOpen,
        openCreateGame: modals.createGame.onOpen,
        openJoinGame: modals.joinGame.onOpen,
        DownloadIcon,
        HelpIcon,
      }}
      createGameModal={createGameModal}
      joinGameModal={joinGameModal}
      helpModal={helpModal}
    />
  )
}
