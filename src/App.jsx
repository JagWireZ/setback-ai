import { useState } from 'react'
import { ActiveGameScreen, HomeScreen, LobbyScreen } from './components/AppScreens'
import {
  AwayContinueModal,
  BidModal,
  ConfirmLobbyActionModal,
  EndOfRoundSummaryModal,
  HelpModal,
  LobbyShareModal,
  RenameLobbyPlayerModal,
} from './components/AppModals'
import { DownloadIcon, GameTablePage, HelpIcon, LinkIcon, ShareIcon } from './components/GameTablePage'
import { useGameActions } from './hooks/useGameActions'
import { useAppRuntime } from './hooks/useAppRuntime'
import { useLobbyDerivedState } from './hooks/useLobbyDerivedState'
import { CreateGameModal, JoinGameModal } from './components/SessionModals'
import { getRoundDirectionArrow } from './utils/gameUi'
import {
  clearGameIdInUrl,
  setGameIdInUrl,
} from './utils/gameSessions'
import { sanitizePlayerNameInput } from './utils/playerName'
import { getPlayerPresence } from './utils/playerPresence'
import { usePwaInstall } from './utils/pwa'

const AI_DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
]

const MAX_SEATS = 8

const isStagingBuild = import.meta.env.VITE_APP_ENV === 'staging'
const buildTimestampLabel = typeof __BUILD_TIMESTAMP__ === 'string' ? __BUILD_TIMESTAMP__ : ''

export default function App() {
  const { canInstall: canInstallApp, promptToInstall } = usePwaInstall()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false)
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
  const [showAwayContinueModal, setShowAwayContinueModal] = useState(false)

  const [ownerSession, setOwnerSession] = useState(null)
  const [playerSession, setPlayerSession] = useState(null)
  const [gameError, setGameError] = useState('')
  const [lobbyInfo, setLobbyInfo] = useState('')
  const [isStartingGame, setIsStartingGame] = useState(false)
  const [isDealingCards, setIsDealingCards] = useState(false)
  const [isBidModalOpen, setIsBidModalOpen] = useState(false)
  const [sortMode, setSortMode] = useState('bySuit')
  const [selectedBid, setSelectedBid] = useState('0')
  const [isSubmittingBid, setIsSubmittingBid] = useState(false)
  const [isPlayingCard, setIsPlayingCard] = useState(false)
  const [isSendingReaction, setIsSendingReaction] = useState(false)
  const [isRenamingPlayer, setIsRenamingPlayer] = useState(false)
  const [isSortingCards, setIsSortingCards] = useState(false)
  const [isContinuingGame, setIsContinuingGame] = useState(false)
  const [isLeavingGame, setIsLeavingGame] = useState(false)
  const [isStartingOver, setIsStartingOver] = useState(false)
  const [isEndOfRoundModalDismissed, setIsEndOfRoundModalDismissed] = useState(false)
  const [persistedEndOfRoundSummary, setPersistedEndOfRoundSummary] = useState(null)
  const [pendingPlayerActionId, setPendingPlayerActionId] = useState('')
  const [isShareLinkCopied, setIsShareLinkCopied] = useState(false)
  const [isLobbyShareModalOpen, setIsLobbyShareModalOpen] = useState(false)
  const [shareQrCodeDataUrl, setShareQrCodeDataUrl] = useState('')
  const [pendingLobbyRemovePlayer, setPendingLobbyRemovePlayer] = useState(null)
  const [pendingLobbyRemoveSeat, setPendingLobbyRemoveSeat] = useState(null)
  const [pendingLobbyRenamePlayer, setPendingLobbyRenamePlayer] = useState(null)
  const [lobbyRenameDraft, setLobbyRenameDraft] = useState('')
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false)
  const [helpSection, setHelpSection] = useState('how-to-play')
  const [reactionCooldownUntil, setReactionCooldownUntil] = useState(0)

  const openLobbyRemovePlayerConfirm = (player) => {
    if (!player) {
      return
    }

    window.setTimeout(() => {
      setPendingLobbyRemovePlayer({
        id: player.id,
        name: player.name,
      })
    }, 0)
  }

  const closeLobbyRemovePlayerConfirm = () => {
    setPendingLobbyRemovePlayer(null)
  }

  const openLobbyRemoveSeatConfirm = (player) => {
    if (!player) {
      return
    }

    window.setTimeout(() => {
      setPendingLobbyRemoveSeat({
        id: player.id,
        name: player.name,
      })
    }, 0)
  }

  const closeLobbyRemoveSeatConfirm = () => {
    setPendingLobbyRemoveSeat(null)
  }

  const openLobbyRenamePlayerModal = (player) => {
    if (!player) {
      return
    }

    window.setTimeout(() => {
      setPendingLobbyRenamePlayer({
        id: player.id,
        name: player.name,
      })
      setLobbyRenameDraft(player.name)
    }, 0)
  }

  const closeLobbyRenamePlayerModal = () => {
    setPendingLobbyRenamePlayer(null)
    setLobbyRenameDraft('')
  }

  const closeCreateModal = () => {
    setIsCreateModalOpen(false)
    setPlayerName('')
    setCreateErrors({})
  }

  const closeJoinModal = () => {
    setIsJoinModalOpen(false)
    setSelectedRejoinGameId('')
    setJoinGameId('')
    setJoinPlayerName('')
    setJoinErrors({})
  }

  const handleJoinGameIdInputChange = (event) => {
    setJoinGameId(event.target.value)
    setJoinErrors((prev) => ({ ...prev, gameId: undefined }))
  }

  const handleJoinPlayerNameInputChange = (event) => {
    setJoinPlayerName(sanitizePlayerNameInput(event.target.value))
    setJoinErrors((prev) => ({ ...prev, playerName: undefined }))
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

  const {
    activeGame,
    activeLobbyPlayer,
    activeLobbyPlayerId,
    activeLobbySession,
    activeRoundIndex,
    activeSessionKey,
    completedRoundCount,
    currentRoundCardCount,
    isLocalPlayerMarkedAway,
    isOwnerLobby,
    isTripRound,
    maxCardsForLobbySeatCount,
    orderedPlayers,
    shareLink,
  } = useLobbyDerivedState({
    ownerSession,
    playerSession,
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
    activeGame,
    activeLobbySession,
    activeSessionKey,
    completedRoundCount,
    isLocalPlayerMarkedAway,
    isOwnerLobby,
    maxCardsForLobbySeatCount,
    selectedMaxCards,
    shareLink,
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

  const closeSubmitBidModal = () => {
    setIsBidModalOpen(false)
    setSelectedBid('0')
  }

  const {
    handleAddSeat,
    handleContinueGame,
    handleCoverAwayPlayerTurn,
    handleCreateGame,
    handleDealCards,
    handleJoinGame,
    handleLeaveGame,
    handleMovePlayer,
    handlePlayCard,
    handleRemovePlayer,
    handleRemoveSeat,
    handleRenamePlayer,
    handleSendReaction,
    handleSortCards,
    handleStartGame,
    handleStartOver,
    handleSubmitBid,
    openSubmitBidModal,
    toggleSortCards,
  } = useGameActions({
    playerName,
    joinGameId,
    selectedRejoinGameId,
    joinPlayerName,
    rejoinableGames,
    ownerSession,
    playerSession,
    selectedMaxCards,
    selectedAiDifficulty,
    orderedPlayers,
    currentRoundCardCount,
    sortMode,
    selectedBid,
    isReactionOnCooldown,
    activeLobbyPlayerId,
    requestActiveStateReview,
    applyRealtimeResult,
    handleRemovedFromGame,
    closeCreateModal,
    closeJoinModal,
    closeSubmitBidModal,
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
    setPendingPlayerActionId,
    setIsLeavingGame,
    setIsStartingGame,
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
    setIsRenamingPlayer,
    setIsPlayingCard,
  })

  const currentDealerPlayerId = ownerSession?.game?.phase?.dealerPlayerId ?? orderedPlayers[0]?.id ?? ''
  const helpModal = (
    <HelpModal
      isOpen={isHelpModalOpen}
      helpSection={helpSection}
      setHelpSection={setHelpSection}
      onClose={() => setIsHelpModalOpen(false)}
    />
  )

  const createGameModal = (
    <CreateGameModal
      isOpen={isCreateModalOpen}
      playerName={playerName}
      playerNameError={createErrors.playerName}
      isCreatingGame={isCreatingGame}
      onClose={closeCreateModal}
      onSubmit={handleCreateGame}
      onPlayerNameChange={(event) => {
        setPlayerName(sanitizePlayerNameInput(event.target.value))
        setCreateErrors((prev) => ({ ...prev, playerName: undefined }))
      }}
    />
  )

  const joinGameModal = (
    <JoinGameModal
      isOpen={isJoinModalOpen}
      joinGameId={joinGameId}
      joinPlayerName={joinPlayerName}
      joinErrors={joinErrors}
      rejoinableGames={rejoinableGames}
      selectedRejoinGameId={selectedRejoinGameId}
      isLoadingRejoinGames={isLoadingRejoinGames}
      isJoiningGame={isJoiningGame}
      isRejoiningGame={isRejoiningGame}
      onClose={closeJoinModal}
      onSubmit={handleJoinGame}
      onJoinGameIdChange={handleJoinGameIdInputChange}
      onJoinPlayerNameChange={handleJoinPlayerNameInputChange}
      onSelectedRejoinGameIdChange={handleRejoinSelectionChange}
    />
  )

  const awayContinueModal = (
    <AwayContinueModal
      isOpen={showAwayContinueModal && isLocalPlayerMarkedAway}
      isContinuingGame={isContinuingGame}
      onContinue={handleContinueGame}
    />
  )

  if (activeGame && activeGame.phase?.stage !== 'Lobby') {
    return (
      <ActiveGameScreen
        gameTable={(
          <GameTablePage
            game={activeGame}
            isOwner={Boolean(ownerSession)}
            ownerPlayerId={ownerSession?.ownerPlayerId ?? ''}
            pendingPlayerActionId={pendingPlayerActionId}
            errorMessage={gameError}
            shareLink={shareLink}
            isShareLinkCopied={isShareLinkCopied}
            onCopyShareLink={handleCopyShareLink}
            onSetGameError={setGameError}
            onRenamePlayer={handleRenamePlayer}
            onRemovePlayer={handleRemovePlayer}
            onCoverAwayPlayerTurn={handleCoverAwayPlayerTurn}
            onLeaveGame={handleLeaveGame}
            onDealCards={handleDealCards}
            onSubmitBid={openSubmitBidModal}
            onPlayCard={handlePlayCard}
            onSortCards={toggleSortCards}
            sortMode={sortMode}
            onStartOver={handleStartOver}
            onSendReaction={handleSendReaction}
            onGoHome={resetActiveSessionState}
            onOpenHelp={() => setIsHelpModalOpen(true)}
            onOpenNewGame={handleOpenNewGame}
            onOpenJoinGame={() => {
              setRequestError('')
              setSessionInfo(null)
              setIsCreateModalOpen(false)
              setIsJoinModalOpen(true)
            }}
            onInstallApp={promptToInstall}
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
            menuCloseRequestKey={joinMenuCloseRequestKey}
            isJoinModalOpen={isJoinModalOpen}
          />
        )}
        bidModal={(
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
        )}
        endOfRoundModal={(
          <EndOfRoundSummaryModal
            summary={persistedEndOfRoundSummary}
            isOpen={!isEndOfRoundModalDismissed}
            getRoundDirectionArrow={getRoundDirectionArrow}
            onClose={() => setIsEndOfRoundModalDismissed(true)}
          />
        )}
        joinModal={joinGameModal}
        awayContinueModal={awayContinueModal}
        helpModal={helpModal}
      />
    )
  }

  if (activeLobbySession?.gameId && activeLobbySession?.game) {
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
        maxSeats={MAX_SEATS}
        maxCardsForLobbySeatCount={maxCardsForLobbySeatCount}
        selectedMaxCards={selectedMaxCards}
        setSelectedMaxCards={setSelectedMaxCards}
        selectedAiDifficulty={selectedAiDifficulty}
        setSelectedAiDifficulty={setSelectedAiDifficulty}
        aiDifficultyOptions={AI_DIFFICULTY_OPTIONS}
        resetActiveSessionState={resetActiveSessionState}
        handleStartGame={handleStartGame}
        setIsLobbyShareModalOpen={setIsLobbyShareModalOpen}
        getPlayerPresence={getPlayerPresence}
        shareIcon={ShareIcon}
        shareModal={(
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
        )}
        removePlayerModal={(
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
        )}
        removeSeatModal={(
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
        )}
        renamePlayerModal={(
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
        )}
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
