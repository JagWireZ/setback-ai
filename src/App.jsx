import { useEffect, useMemo, useRef, useState } from 'react'
import {
  checkState,
  createGame,
  dealCards,
  getGameState,
  joinGame,
  movePlayer,
  playCard,
  renamePlayer,
  removePlayer,
  sendReaction,
  sortCards,
  startGame,
  startOver,
  submitBid,
} from './api/lambdaClient'
import { CardAsset, CardBack } from './components/Cards'
import { RoundStatusLabel, ScoreHistory, ScoreSheet, ScoreSummary } from './components/Scoreboard'
import { CreateGameModal, JoinGameModal } from './components/SessionModals'
import {
  AI_ACTION_DELAY_MS,
  REACTION_COOLDOWN_MS,
  REACTION_EMOJIS,
  TRICK_COMPLETE_DELAY_MS,
  buildRoundSummary,
  getBidDisplay,
  getCardLabel,
  getCompletedRoundCount,
  getInvalidPlayMessage,
  getPlayerName,
  getRoundDirectionArrow,
  getViewerHand,
  hashString,
  toUserFacingActionError,
} from './utils/gameUi'
import {
  clearGameIdInUrl,
  clearStoredGameSession,
  getGameIdFromUrl,
  getStoredGameSession,
  normalizeStoredSessionGame,
  pruneMissingStoredGameSessions,
  saveStoredGameSession,
  setGameIdInUrl,
} from './utils/gameSessions'
import {
  MAX_PLAYER_NAME_LENGTH,
  sanitizePlayerNameInput,
  truncateLabel,
  validatePlayerName,
} from './utils/playerName'

const AI_DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
]

function GameTablePage({
  game,
  isOwner,
  ownerPlayerId = '',
  pendingPlayerActionId = '',
  errorMessage,
  shareLink,
  isShareLinkCopied,
  onCopyShareLink,
  onSetGameError,
  onRenamePlayer,
  onRemovePlayer,
  onLeaveGame,
  onDealCards,
  onSubmitBid,
  onPlayCard,
  onSortCards,
  sortMode = 'bySuit',
  onStartOver,
  onSendReaction,
  onGoHome,
  onOpenHelp,
  onOpenNewGame,
  onOpenJoinGame,
  isDealingCards,
  isStartingOver,
  isSubmittingBid,
  isPlayingCard,
  isSendingReaction,
  isReactionOnCooldown,
  isRenamingPlayer,
  isLeavingGame,
  isSortingCards,
  isLoadingRejoinGames,
  menuCloseRequestKey = 0,
  isJoinModalOpen = false,
}) {
  const viewerHand = getViewerHand(game)
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 1024 : window.innerWidth,
  )
  const [mobileActionBarHeight, setMobileActionBarHeight] = useState(0)
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false)

  useEffect(() => {
    if (menuCloseRequestKey > 0) {
      setIsMenuModalOpen(false)
    }
  }, [menuCloseRequestKey])

  const viewerPlayerId = viewerHand?.playerId
  const currentTurnPlayerId = game?.phase && 'turnPlayerId' in game.phase ? game.phase.turnPlayerId : undefined
  const currentRound = game?.phase && 'roundIndex' in game.phase ? game.phase.roundIndex + 1 : 1
  const totalRounds = game?.options?.rounds?.length ?? 0
  const currentRoundIndex = game?.phase && 'roundIndex' in game.phase ? game.phase.roundIndex : 0
  const currentRoundConfig = game?.options?.rounds?.[currentRoundIndex]
  const bids = game?.phase && 'bids' in game.phase ? game.phase.bids : []
  const currentTrick = game?.phase && 'cards' in game.phase ? game.phase.cards.currentTrick : undefined
  const trumpCard = game?.phase && 'cards' in game.phase ? game.phase.cards.trump : undefined
  const completedTricks = game?.phase && 'cards' in game.phase ? game.phase.cards.completedTricks ?? [] : []
  const latestCompletedTrick = completedTricks[completedTricks.length - 1]
  const orderedPlayers = useMemo(() => {
    const playersById = new Map((game.players ?? []).map((player) => [player.id, player]))
    const ordered = (game.playerOrder ?? [])
      .map((playerId) => playersById.get(playerId))
      .filter(Boolean)

    return ordered.length > 0 ? ordered : game.players ?? []
  }, [game.playerOrder, game.players])
  const biddingPlayers = useMemo(() => {
    if (orderedPlayers.length === 0) {
      return []
    }

    if (game.phase?.stage !== 'Bidding') {
      return orderedPlayers
    }

    const dealerPlayerId = game.phase.dealerPlayerId
    const dealerIndex = orderedPlayers.findIndex((player) => player.id === dealerPlayerId)
    if (dealerIndex < 0) {
      return orderedPlayers
    }

    const firstBidderIndex = (dealerIndex + 1) % orderedPlayers.length
    return [
      ...orderedPlayers.slice(firstBidderIndex),
      ...orderedPlayers.slice(0, firstBidderIndex),
    ]
  }, [game.phase, orderedPlayers])
  const bidsByPlayerId = useMemo(() => new Map(bids.map((bid) => [bid.playerId, bid])), [bids])
  const booksByPlayerId = useMemo(() => {
    const books = new Map()

    for (const trick of completedTricks) {
      if (!trick?.winnerPlayerId) {
        continue
      }

      books.set(trick.winnerPlayerId, (books.get(trick.winnerPlayerId) ?? 0) + 1)
    }

    return books
  }, [game?.phase])
  const [selectedCardIndex, setSelectedCardIndex] = useState(null)
  const [selectedTrickCardIndex, setSelectedTrickCardIndex] = useState(null)
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [isResetConfirmModalOpen, setIsResetConfirmModalOpen] = useState(false)
  const [isReactionModalOpen, setIsReactionModalOpen] = useState(false)
  const [isEditingPlayerName, setIsEditingPlayerName] = useState(false)
  const [selectedScorePlayerId, setSelectedScorePlayerId] = useState('')
  const [scorePlayerNameDraft, setScorePlayerNameDraft] = useState('')
  const [editedPlayerName, setEditedPlayerName] = useState('')
  const [bookWinnerMessage, setBookWinnerMessage] = useState('')
  const [revealedCompletedTrick, setRevealedCompletedTrick] = useState(null)
  const previousCompletedTrickCountRef = useRef(0)
  const bookWinnerTimeoutRef = useRef(null)
  const selectedTrickCardTimeoutRef = useRef(null)
  const mobileActionBarRef = useRef(null)
  const reactionPickerRef = useRef(null)
  const hasAutoOpenedGameOverScoreRef = useRef(false)
  const gameOverScoreTimeoutRef = useRef(null)

  const isViewerTurn = Boolean(viewerPlayerId && currentTurnPlayerId && viewerPlayerId === currentTurnPlayerId)
  const canSelectCards = game.phase?.stage === 'Playing' && isViewerTurn
  const viewerTurnMessage =
    game.phase?.stage === 'Playing'
      ? 'Your Turn to Play'
      : game.phase?.stage === 'Bidding'
        ? 'Your Turn to Bid'
        : game.phase?.stage === 'Dealing'
          ? 'Your Turn to Deal'
          : 'Your Turn'
  const waitingAction =
    game.phase?.stage === 'Playing'
      ? 'Play'
      : game.phase?.stage === 'Bidding'
        ? 'Bid'
        : game.phase?.stage === 'Dealing'
          ? 'Deal'
          : ''
  const isGameOver = game.phase?.stage === 'GameOver'
  const isTrickWinnerRevealVisible = Boolean(bookWinnerMessage)
  const displayedTrick = revealedCompletedTrick ?? currentTrick
  const displayedTrickPlays = displayedTrick?.plays ?? []
  const winningDisplayedTrickCardIndex =
    revealedCompletedTrick?.winnerPlayerId
      ? revealedCompletedTrick.plays.findIndex((play) => play.playerId === revealedCompletedTrick.winnerPlayerId)
      : null
  const selectedCard =
    selectedCardIndex !== null && viewerHand?.cards?.[selectedCardIndex]
      ? viewerHand.cards[selectedCardIndex]
      : null
  const handCardCount = viewerHand?.cards?.length ?? 0
  const isMobileViewport = viewportWidth < 640
  const currentPlayerName = getPlayerName(game, viewerPlayerId)
  const selectedScorePlayer =
    orderedPlayers.find((player) => player.id === selectedScorePlayerId) ??
    game.players?.find((player) => player.id === selectedScorePlayerId) ??
    null
  const activeReactions = game?.reactions ?? []
  const reactionLayouts = useMemo(
    () =>
      activeReactions.map((reaction, index) => {
        const hash = hashString(reaction.id)
        const left = 38 + (hash % 25)
        const driftDirection = hash % 2 === 0 ? 1 : -1
        const driftA = driftDirection * (18 + ((hash >> 3) % 10))
        const driftB = driftDirection * -1 * (14 + ((hash >> 6) % 12))
        const driftC = driftDirection * (24 + ((hash >> 9) % 14))
        const delay = (index % 3) * 0.08

        return {
          reaction,
          style: {
            left: `${left}%`,
            bottom: `${mobileActionBarHeight + 24 + (hash % 3) * 6}px`,
            animationDelay: `${delay}s`,
            '--reaction-sway-a': `${driftA}px`,
            '--reaction-sway-b': `${driftB}px`,
            '--reaction-sway-c': `${driftC}px`,
          },
        }
      }),
    [activeReactions, mobileActionBarHeight],
  )

  const handLayout = useMemo(() => {
    if (!isMobileViewport) {
      return {
        cardWidth: '5rem',
        overlapOffset: '-3.75rem',
        useCompactSizing: false,
      }
    }

    const availableWidthPx = Math.max(viewportWidth - 56, 220)
    const visibleFraction = 0.42
    const factor = 1 + Math.max(handCardCount - 1, 0) * visibleFraction
    const cardWidthPx = Math.min(80, Math.max(52, availableWidthPx / factor))
    const overlapOffsetPx = -(cardWidthPx * (1 - visibleFraction))

    return {
      cardWidth: `${cardWidthPx / 16}rem`,
      overlapOffset: `${overlapOffsetPx / 16}rem`,
      useCompactSizing: true,
    }
  }, [handCardCount, isMobileViewport, viewportWidth])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const handleResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    if (!canSelectCards) {
      setSelectedCardIndex(null)
      return
    }

    if (!viewerHand?.cards?.[selectedCardIndex ?? -1]) {
      setSelectedCardIndex(null)
    }
  }, [canSelectCards, viewerHand?.cards, selectedCardIndex])

  useEffect(() => {
    setSelectedCardIndex(null)
  }, [game.phase?.stage, game.phase?.trickIndex, currentTurnPlayerId])

  useEffect(() => {
    if (winningDisplayedTrickCardIndex !== null && winningDisplayedTrickCardIndex >= 0) {
      setSelectedTrickCardIndex(winningDisplayedTrickCardIndex)
      return
    }

    if (!displayedTrickPlays[selectedTrickCardIndex ?? -1]) {
      setSelectedTrickCardIndex(null)
    }
  }, [displayedTrickPlays, selectedTrickCardIndex, winningDisplayedTrickCardIndex])

  useEffect(() => {
    if (bookWinnerMessage || selectedTrickCardIndex === null) {
      if (selectedTrickCardTimeoutRef.current) {
        clearTimeout(selectedTrickCardTimeoutRef.current)
        selectedTrickCardTimeoutRef.current = null
      }
      return
    }

    selectedTrickCardTimeoutRef.current = setTimeout(() => {
      setSelectedTrickCardIndex(null)
      selectedTrickCardTimeoutRef.current = null
    }, 2000)

    return () => {
      if (selectedTrickCardTimeoutRef.current) {
        clearTimeout(selectedTrickCardTimeoutRef.current)
        selectedTrickCardTimeoutRef.current = null
      }
    }
  }, [bookWinnerMessage, selectedTrickCardIndex])

  useEffect(() => {
    if (!isMenuModalOpen) {
      setIsEditingPlayerName(false)
      setEditedPlayerName(currentPlayerName)
      return
    }

    if (!isEditingPlayerName) {
      setEditedPlayerName(currentPlayerName)
    }
  }, [currentPlayerName, isEditingPlayerName, isMenuModalOpen])

  const shortenedMenuPlayerName = truncateLabel(currentPlayerName, 18)

  useEffect(() => {
    if (!selectedScorePlayerId) {
      return
    }

    if (!selectedScorePlayer) {
      setSelectedScorePlayerId('')
      setScorePlayerNameDraft('')
      return
    }

    setScorePlayerNameDraft(selectedScorePlayer.name)
  }, [selectedScorePlayer?.name, selectedScorePlayerId])

  const closeScorePlayerModal = () => {
    setSelectedScorePlayerId('')
    setScorePlayerNameDraft('')
  }

  useEffect(() => {
    if (!isReactionModalOpen || typeof window === 'undefined') {
      return undefined
    }

    const handlePointerDown = (event) => {
      if (reactionPickerRef.current?.contains(event.target)) {
        return
      }

      setIsReactionModalOpen(false)
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isReactionModalOpen])

  useEffect(() => {
    previousCompletedTrickCountRef.current = completedTricks.length
    setBookWinnerMessage('')
    setRevealedCompletedTrick(null)
    hasAutoOpenedGameOverScoreRef.current = false

    if (bookWinnerTimeoutRef.current) {
      clearTimeout(bookWinnerTimeoutRef.current)
      bookWinnerTimeoutRef.current = null
    }
  }, [game?.id])

  useEffect(() => {
    if (isGameOver && !bookWinnerMessage && !hasAutoOpenedGameOverScoreRef.current) {
      setIsScoreModalOpen(true)
      hasAutoOpenedGameOverScoreRef.current = true
    }

    if (!isGameOver) {
      hasAutoOpenedGameOverScoreRef.current = false
    }
  }, [bookWinnerMessage, isGameOver])

  useEffect(() => {
    const latestTrick = completedTricks[completedTricks.length - 1]
    const previousCompletedTrickCount = previousCompletedTrickCountRef.current

    if (completedTricks.length < previousCompletedTrickCount) {
      setBookWinnerMessage('')
      setRevealedCompletedTrick(null)
      if (bookWinnerTimeoutRef.current) {
        clearTimeout(bookWinnerTimeoutRef.current)
        bookWinnerTimeoutRef.current = null
      }
    } else if (completedTricks.length > previousCompletedTrickCount && latestTrick?.winnerPlayerId) {
      setRevealedCompletedTrick(latestTrick)
      setBookWinnerMessage(`${getPlayerName(game, latestTrick.winnerPlayerId)} won the book!`)
      if (bookWinnerTimeoutRef.current) {
        clearTimeout(bookWinnerTimeoutRef.current)
      }
      bookWinnerTimeoutRef.current = setTimeout(() => {
        setBookWinnerMessage('')
        setRevealedCompletedTrick(null)
        bookWinnerTimeoutRef.current = null
      }, TRICK_COMPLETE_DELAY_MS)
    }

    previousCompletedTrickCountRef.current = completedTricks.length
  }, [completedTricks, game, game?.version])

  useEffect(() => {
    return () => {
      if (bookWinnerTimeoutRef.current) {
        clearTimeout(bookWinnerTimeoutRef.current)
      }
      if (gameOverScoreTimeoutRef.current) {
        clearTimeout(gameOverScoreTimeoutRef.current)
      }
      if (selectedTrickCardTimeoutRef.current) {
        clearTimeout(selectedTrickCardTimeoutRef.current)
      }
    }
  }, [])

  const availableActions = (() => {
    switch (game.phase?.stage) {
      case 'Dealing':
        return isViewerTurn ? ['Deal Cards'] : []
      case 'Bidding':
        return isViewerTurn ? ['Submit Bid'] : []
      case 'Playing':
        return isViewerTurn ? ['Play Card'] : []
      case 'Scoring':
        return []
      case 'GameOver':
        return isOwner ? ['Start Over'] : []
      default:
        return []
    }
  })()

  const canSortCards = game.phase?.stage !== 'Dealing' && (viewerHand?.cards?.length ?? 0) > 0 && typeof onSortCards === 'function'

  useEffect(() => {
    if (typeof window === 'undefined' || !mobileActionBarRef.current) {
      return undefined
    }

    const updateHeight = () => {
      setMobileActionBarHeight(mobileActionBarRef.current?.getBoundingClientRect().height ?? 0)
    }

    updateHeight()

    const observer = new ResizeObserver(() => {
      updateHeight()
    })

    observer.observe(mobileActionBarRef.current)
    window.addEventListener('resize', updateHeight)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateHeight)
    }
  }, [canSortCards, availableActions.length])

  const isActionEnabled = (action) => {
    if (action === 'Deal Cards') {
      return typeof onDealCards === 'function'
    }

    if (action === 'Submit Bid') {
      return typeof onSubmitBid === 'function'
    }

    if (action === 'Play Card') {
      return typeof onPlayCard === 'function' && canSelectCards && selectedCard !== null
    }

    if (action === 'Start Over') {
      return typeof onStartOver === 'function'
    }

    if (action === 'New Game') {
      return typeof onOpenNewGame === 'function'
    }

    if (action === 'Join Game') {
      return typeof onOpenJoinGame === 'function'
    }

    return false
  }

  const renderActionBarContent = (isMobileBar) => (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-3">
      <div className="flex items-center justify-start gap-3">
        <button
          type="button"
          className="min-h-12 border-0 bg-transparent px-1 py-1 text-[1.55rem] leading-none text-white transition hover:scale-110"
          onClick={() => setIsMenuModalOpen(true)}
          aria-label="Open game menu"
        >
          ☰
        </button>
      </div>
      <div className="min-w-0">
        <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:w-max sm:min-w-full sm:flex-nowrap sm:gap-3">
          {isMobileBar ? (
            <button
              type="button"
              className="btn-accent min-h-11 whitespace-nowrap px-3 py-2.5 text-xs sm:min-h-12 sm:px-4 sm:py-3 sm:text-sm"
              onClick={() => setIsScoreModalOpen(true)}
            >
              Score
            </button>
          ) : null}
          {canSortCards ? (
            <button
              type="button"
              className="btn-accent min-h-11 whitespace-nowrap px-3 py-2.5 text-xs disabled:opacity-50 sm:min-h-12 sm:px-4 sm:py-3 sm:text-sm"
              onClick={onSortCards}
              disabled={isSortingCards}
            >
              {isSortingCards ? (
                'Sorting...'
              ) : (
                <span className="inline-flex items-center gap-2">
                  <span className="sort-toggle-icon" aria-hidden="true">
                    <span />
                    <i />
                  </span>
                  <span>{sortMode === 'bySuit' ? 'By Rank' : 'By Suit'}</span>
                </span>
              )}
            </button>
          ) : null}
          {availableActions.length > 0 ? (
            availableActions.map((action) => {
              const isDisabled =
                !isActionEnabled(action) ||
                isDealingCards ||
                isSubmittingBid ||
                isPlayingCard ||
                isSortingCards ||
                isStartingOver
              const shouldFlashActionButton =
                ((action === 'Deal Cards' || action === 'Submit Bid') && isViewerTurn && !isDisabled) ||
                (action === 'Play Card' && isViewerTurn && selectedCard !== null && !isDisabled)
              const isPrimaryAction =
                !isDisabled &&
                (action === 'Deal Cards' || action === 'Submit Bid' || action === 'Play Card' || action === 'Start Over')

              return (
                <button
                  key={action}
                  type="button"
                  className={`min-h-11 whitespace-nowrap rounded-md border px-3 py-2.5 text-xs text-white disabled:opacity-50 sm:min-h-12 sm:px-4 sm:py-3 sm:text-sm ${
                    shouldFlashActionButton
                      ? 'btn-accent-pulse animate-pulse'
                      : isPrimaryAction
                        ? 'btn-accent btn-accent-glow'
                        : 'btn-accent'
                  }`}
                  disabled={isDisabled}
                  onClick={
                    action === 'Deal Cards'
                      ? onDealCards
                      : action === 'Submit Bid'
                        ? onSubmitBid
                        : action === 'Play Card'
                          ? () => {
                              if (selectedCard) {
                                onPlayCard(selectedCard)
                              }
                            }
                          : action === 'Start Over'
                            ? onStartOver
                            : action === 'New Game'
                              ? onOpenNewGame
                              : action === 'Join Game'
                                ? onOpenJoinGame
                                : undefined
                  }
                >
                  {action === 'Deal Cards' && isDealingCards
                    ? 'Dealing...'
                    : action === 'Start Over' && isStartingOver
                      ? 'Starting...'
                      : action === 'Submit Bid' && isSubmittingBid
                        ? 'Submitting...'
                        : action === 'Play Card' && isPlayingCard
                          ? 'Playing...'
                          : action === 'Submit Bid'
                            ? 'Bid'
                            : action}
                </button>
              )
            })
          ) : null}
        </div>
      </div>
      <div
        className="relative flex items-center justify-end"
        ref={isMobileBar === isMobileViewport ? reactionPickerRef : undefined}
      >
        {isReactionModalOpen && isMobileBar === isMobileViewport ? (
          <div className="floating-panel absolute bottom-full right-0 z-50 mb-3 w-[13rem] rounded-2xl p-3">
            <div className="grid grid-cols-4 gap-2">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="flex h-11 items-center justify-center rounded-xl bg-transparent text-2xl transition hover:scale-110 disabled:opacity-50"
                  onClick={async () => {
                    try {
                      await onSendReaction?.(emoji)
                      setIsReactionModalOpen(false)
                    } catch {
                      // Keep the picker open so the user can retry.
                    }
                  }}
                  disabled={isSendingReaction || isReactionOnCooldown}
                  aria-label={`Send ${emoji} reaction`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <button
          type="button"
          className="min-h-12 border-0 bg-transparent px-1 py-1 text-3xl leading-none text-white transition hover:scale-110 disabled:opacity-50"
          onClick={() => setIsReactionModalOpen((current) => !current)}
          disabled={isSendingReaction || isReactionOnCooldown || typeof onSendReaction !== 'function'}
          aria-label="Open reactions"
        >
          😀
        </button>
      </div>
    </div>
  )

  return (
    <div className="contents">
      <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
        {reactionLayouts.map(({ reaction, style }) => (
          <div
            key={reaction.id}
            className="reaction-float"
            style={style}
          >
            <div className="reaction-badge">
              <span className="truncate">{getPlayerName(game, reaction.playerId)}</span>
              <span className="text-xl leading-none">{reaction.emoji}</span>
            </div>
          </div>
        ))}
      </div>
      <main
        className="theme-shell h-[100dvh] overflow-hidden md:h-screen md:px-3 md:py-3"
        style={{ '--mobile-action-bar-height': `${mobileActionBarHeight}px` }}
      >
      <section className="relative mx-auto flex h-[calc(100dvh-var(--mobile-action-bar-height,0px))] w-full max-w-none flex-col md:h-full md:max-w-6xl">
        <div
          className="table-surface flex h-full min-h-0 w-full flex-col rounded-none border-0 md:rounded-3xl md:border md:border-b-0"
          style={{ borderColor: 'var(--border-color)' }}
        >
        <div className="flex min-h-0 flex-1 flex-col p-2 pb-2 sm:p-3 md:pb-3">
        <article className="shrink-0 px-1 py-3 -translate-y-[15%]">
          <div className="flex items-center justify-between gap-4 text-sm text-muted">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <button
                type="button"
                className="w-fit rounded-md transition hover:scale-[1.02]"
                onClick={onGoHome}
                aria-label="Go home"
              >
                <img
                  src="/logo-512x512.png"
                  alt="Setback"
                  className="h-20 w-20 shrink-0 rounded-md"
                />
              </button>
            </div>
            {trumpCard ? (
              <div className="mt-2 flex shrink-0 items-center gap-2 self-start md:mt-0">
                <p className="text-sm text-dim">Trump</p>
                <div className="relative h-[76px] w-[70px] shrink-0 md:h-[84px] md:w-[78px]">
                  <div className="absolute left-0 top-0 h-[76px] w-[54px] md:h-[84px] md:w-[60px]">
                    <CardBack />
                  </div>
                  <div
                    className="absolute top-0 h-[76px] w-[54px] md:h-[84px] md:w-[60px]"
                    style={{ left: '0.75rem' }}
                  >
                    <CardAsset card={trumpCard} showCornerSuit={false} />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </article>

        <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[30%_1fr]">
          <article className="score-scroll score-panel hidden min-h-0 max-h-full self-start overflow-auto rounded-2xl border pb-4 pl-4 pr-1 pt-4 md:block">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Score</h2>
              {isGameOver ? (
                <p className="text-lg font-medium text-muted">Game Over</p>
              ) : currentRoundConfig ? (
                <p className="text-lg font-medium text-muted">
                  <span>{`Round ${currentRoundConfig.cardCount} `}</span>
                  <span className="text-lg">{currentRoundConfig.direction === 'up' ? '⬆' : '⬇'}</span>
                </p>
              ) : (
                <p className="text-lg font-medium text-muted">Round N/A</p>
              )}
            </div>
            <ScoreSummary
              game={game}
              bids={bids}
              booksByPlayerId={booksByPlayerId}
              currentRoundIndex={currentRoundIndex}
              isGameOver={isGameOver}
              isOwner={isOwner}
              onSelectPlayer={(player) => setSelectedScorePlayerId(player.id)}
            />
            <div className="mt-4 flex justify-end pr-3">
              <button
                type="button"
                className="link-accent"
                onClick={() => setIsHistoryModalOpen(true)}
              >
                See History
              </button>
            </div>
          </article>

          <article
            className="flex min-h-0 flex-col p-1"
            onClick={(event) => {
              if (selectedTrickCardIndex === null || bookWinnerMessage) {
                return
              }

              if (event.target.closest('button')) {
                return
              }

              setSelectedTrickCardIndex(null)
            }}
          >
            <div className="mb-3 flex min-h-7 items-center justify-center">
              {isGameOver || isTrickWinnerRevealVisible ? null : isViewerTurn ? (
                <p className="status-turn px-6 py-2 text-xl font-semibold">
                  {viewerTurnMessage}
                </p>
              ) : currentTurnPlayerId ? (
                <p className="text-sm text-dim">
                  {waitingAction
                    ? `Waiting on ${getPlayerName(game, currentTurnPlayerId)} to ${waitingAction}`
                    : `Waiting on ${getPlayerName(game, currentTurnPlayerId)}...`}
                </p>
              ) : null}
            </div>
            {game.phase?.stage === 'Bidding' ? (
              <section className="callout-success mb-3 flex min-h-0 flex-1 flex-col rounded-2xl border px-3 py-3 sm:px-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-accent-strong text-sm font-semibold uppercase tracking-[0.18em]">Bids</h2>
                  <p className="text-accent text-xs">
                    {bids.length}/{biddingPlayers.length} in
                  </p>
                </div>
                <ul className="score-scroll mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-auto pr-1">
                  {biddingPlayers.map((player) => {
                    const bidEntry = bidsByPlayerId.get(player.id)
                    const isCurrentBidder = currentTurnPlayerId === player.id
                    const hasBid = Boolean(bidEntry)
                    const playerScore = game.scores?.find((entry) => entry.playerId === player.id)
                    const playerRainbow = playerScore?.rounds?.[currentRoundIndex]?.rainbow === true

                    return (
                      <li
                        key={player.id}
                        className={`rounded-xl border px-3 py-2 text-left ${
                          isCurrentBidder
                            ? 'callout-success-strong'
                            : 'list-item-subtle'
                        }`}
                      >
                        <div className="grid grid-cols-[minmax(0,1fr)_3rem_4.75rem] items-center gap-3">
                          <p className="min-w-0 truncate text-sm font-medium text-white">
                            {player.name}
                            {playerRainbow ? ' 🌈' : ''}
                          </p>
                          <p className={`text-right text-base font-semibold ${hasBid ? 'text-accent-strong' : 'text-dim'}`}>
                            {getBidDisplay(bidEntry)}
                          </p>
                          <p className="text-right text-[0.68rem] uppercase tracking-[0.14em] text-dim">
                            {hasBid ? 'Locked' : isCurrentBidder ? 'Bidding' : 'Waiting'}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ) : null}
            {bookWinnerMessage ? (
              <div className="mb-3 flex items-center justify-center">
                <p className="text-info text-center text-lg">{bookWinnerMessage}</p>
              </div>
            ) : null}
            {game.phase?.stage === 'Bidding' ? null : (
              <ul className="flex min-h-[152px] flex-1 items-center justify-center gap-4 overflow-x-auto -translate-y-2">
                {displayedTrickPlays.length > 0 ? (
                  displayedTrickPlays.map((play, index) => (
                    <li
                      key={`${play.playerId}-${index}`}
                      className="flex w-fit shrink-0 flex-col items-center text-sm"
                      style={{ marginLeft: index === 0 ? '0' : '-3.25rem', zIndex: selectedTrickCardIndex === index ? 100 : index + 1 }}
                    >
                      <div className="mb-3 flex h-5 items-end justify-center">
                        {selectedTrickCardIndex === index ? (
                          <p className="text-center text-lg text-white">{getPlayerName(game, play.playerId)}</p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className={`relative shrink-0 overflow-visible rounded-lg bg-transparent p-0 transition-transform duration-150 ${
                          selectedTrickCardIndex === index ? '-translate-y-2' : 'translate-y-0'
                        }`}
                        onClick={() => {
                          if (bookWinnerMessage) {
                            return
                          }
                          setSelectedTrickCardIndex((currentIndex) => (currentIndex === index ? null : index))
                        }}
                        aria-label={getPlayerName(game, play.playerId)}
                      >
                        <div className="aspect-[2.5/3.5] w-24 sm:w-28">
                          <CardAsset
                            card={play.card}
                            jokerTextClassName="text-[70%] font-bold tracking-[0.06em]"
                          />
                        </div>
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="self-center text-sm text-dim">
                    {isGameOver ? '' : 'No cards played in this trick yet.'}
                  </li>
                )}
              </ul>
            )}
          </article>
        </div>

        {errorMessage ? (
          <div className="mt-3 flex justify-center">
            <p className="error-inline max-w-xl rounded-md px-3 py-2 text-center text-sm">
              {errorMessage}
            </p>
          </div>
        ) : null}
        <article
          className={`mt-3 shrink-0 overflow-hidden rounded-3xl border p-1 sm:overflow-x-auto ${
            canSelectCards
              ? 'hand-active'
              : 'divider'
          }`}
        >
          <div className="flex min-h-[8rem] items-center justify-center pt-6 pb-2">
            {(viewerHand?.cards ?? []).length > 0 ? (
              viewerHand.cards.map((card, index) => {
                const invalidPlayMessage = canSelectCards ? getInvalidPlayMessage(game, viewerHand, card) : ''
                const isInvalidPlay = invalidPlayMessage.length > 0

                return (
                  <button
                    key={`${card.rank}-${card.suit}-${index}`}
                    type="button"
                    onClick={() => {
                      if (!canSelectCards) {
                        return
                      }

                      if (isInvalidPlay) {
                        setSelectedCardIndex(null)
                        onSetGameError?.(invalidPlayMessage)
                        return
                      }

                      onSetGameError?.('')
                      setSelectedCardIndex((currentIndex) => (currentIndex === index ? null : index))
                    }}
                    disabled={!canSelectCards || isPlayingCard}
                    className={`relative shrink-0 overflow-visible rounded-lg bg-transparent p-0 transition-all duration-150 ${
                      selectedCardIndex === index ? '-translate-y-4' : 'translate-y-0'
                    }`}
                    style={{
                      marginLeft: index === 0 ? '0' : handLayout.overlapOffset,
                      zIndex: index + 1,
                    }}
                    aria-label={getCardLabel(card)}
                  >
                    <div
                      className={`aspect-[2.5/3.5] ${handLayout.useCompactSizing ? '' : 'w-20 sm:w-24'}`}
                      style={{
                        ...(handLayout.useCompactSizing ? { width: handLayout.cardWidth } : {}),
                        filter: canSelectCards
                          ? isInvalidPlay
                            ? 'brightness(0.50)'
                            : 'drop-shadow(0 0 12px rgba(120, 255, 180, 0.22))'
                          : undefined,
                      }}
                    >
                      <CardAsset
                        card={card}
                        showCenterSymbol={!handLayout.useCompactSizing}
                        centerSymbolClassName="text-[104%] leading-none sm:text-[132%]"
                        jokerTextClassName="text-[42%] font-bold tracking-[0.06em]"
                      />
                    </div>
                  </button>
                )
              })
            ) : (
              <p className="text-sm text-dim">{isGameOver ? '' : 'No cards in hand yet.'}</p>
            )}
          </div>
          <div className="hidden md:block">
            {renderActionBarContent(false)}
          </div>
        </article>
        </div>
        </div>
      </section>
      <div
        ref={mobileActionBarRef}
        className="fixed inset-x-0 bottom-0 z-40 md:hidden"
        style={{
          backgroundColor: 'rgba(20, 20, 20, 0.25)',
        }}
      >
        {renderActionBarContent(true)}
      </div>
      {isScoreModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 px-4 py-4"
          onClick={() => setIsScoreModalOpen(false)}
        >
          <div
            className="dialog-surface max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-xl p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <ScoreSheet
              title="Score"
              game={game}
              bids={bids}
              booksByPlayerId={booksByPlayerId}
              currentRoundIndex={currentRoundIndex}
              currentRoundConfig={currentRoundConfig}
              isGameOver={isGameOver}
              isOwner={isOwner}
              onSelectPlayer={(player) => setSelectedScorePlayerId(player.id)}
              onOpenHistory={() => setIsHistoryModalOpen(true)}
              onClose={() => setIsScoreModalOpen(false)}
            />
          </div>
        </div>
      )}
      {isHistoryModalOpen ? (
        <ScoreHistory
          game={game}
          onClose={() => setIsHistoryModalOpen(false)}
        />
      ) : null}
      {selectedScorePlayer ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 px-4 py-4"
          onClick={closeScorePlayerModal}
        >
          <div
            className="dialog-surface max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-6 text-left"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Manage Player</h2>
            </div>
            <p className="mt-2 text-sm text-muted">{selectedScorePlayer.name}</p>
            <form
              className="mt-4 flex flex-col gap-4"
              onSubmit={async (event) => {
                event.preventDefault()
                if (!selectedScorePlayer) {
                  return
                }

                const validationError = validatePlayerName(scorePlayerNameDraft)
                if (validationError) {
                  onSetGameError(validationError)
                  return
                }

                const didRename = await onRenamePlayer?.(
                  scorePlayerNameDraft.trim(),
                  selectedScorePlayer.id,
                )
                if (didRename) {
                  closeScorePlayerModal()
                }
              }}
            >
              <label className="flex flex-col gap-2">
                <span className="text-sm text-muted">Player Name</span>
                <input
                  type="text"
                  value={scorePlayerNameDraft}
                  onChange={(event) => {
                    setScorePlayerNameDraft(sanitizePlayerNameInput(event.target.value))
                    onSetGameError('')
                  }}
                  className="input-surface"
                  placeholder="Player name"
                  maxLength={MAX_PLAYER_NAME_LENGTH}
                  autoFocus
                />
              </label>
              <div className="flex justify-between gap-3">
                <button
                  type="button"
                  className="btn-danger btn-danger-soft px-4 py-2 disabled:opacity-50"
                  onClick={async () => {
                    if (!selectedScorePlayer) {
                      return
                    }

                    onSetGameError('')
                    const didRemove = await onRemovePlayer?.(selectedScorePlayer.id)
                    if (didRemove) {
                      closeScorePlayerModal()
                    }
                  }}
                  disabled={
                    isRenamingPlayer ||
                    pendingPlayerActionId === selectedScorePlayer.id ||
                    selectedScorePlayer.type === 'ai' ||
                    selectedScorePlayer.id === ownerPlayerId
                  }
                >
                  {pendingPlayerActionId === selectedScorePlayer.id ? 'Removing...' : 'Remove Player'}
                </button>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    className="btn-secondary px-4 py-2"
                    onClick={closeScorePlayerModal}
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="btn-primary px-4 py-2 disabled:opacity-50"
                    disabled={isRenamingPlayer || !scorePlayerNameDraft.trim()}
                  >
                    {isRenamingPlayer ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {isMenuModalOpen && !isJoinModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 px-4 py-4"
          onClick={() => setIsMenuModalOpen(false)}
        >
          <div
            className="dialog-surface max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto p-6 text-left"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <button
                  type="button"
                  className="block max-w-[12rem] min-w-0 truncate text-left text-xl font-semibold text-white transition hover:[color:var(--accent-green-soft)] sm:max-w-[14rem]"
                  onClick={() => {
                    setIsEditingPlayerName(true)
                    setEditedPlayerName(currentPlayerName)
                  }}
                  title={currentPlayerName}
                >
                  {`👤 ${shortenedMenuPlayerName}`}
                </button>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  className="badge-subtle rounded-full border px-3 py-1 text-sm font-medium text-muted transition hover:text-white"
                  onClick={onCopyShareLink}
                  title="Copy game link"
                >
                  {isShareLinkCopied ? '🔗 Copied!' : '🔗 ' + game.id}
                </button>
              </div>
            </div>
            <div className="divider mt-4 border-t" />
            {isEditingPlayerName ? (
              <form
                className="mt-4 flex flex-col gap-3"
                onSubmit={async (event) => {
                  event.preventDefault()
                  const nextName = editedPlayerName.trim()
                  if (!nextName || nextName === currentPlayerName) {
                    setIsEditingPlayerName(false)
                    setEditedPlayerName(currentPlayerName)
                    return
                  }

                  const didRename = await onRenamePlayer?.(nextName)
                  if (didRename) {
                    setIsEditingPlayerName(false)
                  }
                }}
              >
                <input
                  type="text"
                  value={editedPlayerName}
                  onChange={(event) => setEditedPlayerName(event.target.value)}
                  className="input-surface"
                  placeholder="Player name"
                  maxLength={32}
                  autoFocus
                />
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    className="btn-secondary px-4 py-2"
                    onClick={() => {
                      setIsEditingPlayerName(false)
                      setEditedPlayerName(currentPlayerName)
                    }}
                    disabled={isRenamingPlayer}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary px-4 py-2 disabled:opacity-50"
                    disabled={isRenamingPlayer || !editedPlayerName.trim()}
                  >
                    {isRenamingPlayer ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            ) : null}
            <div className="mt-4 flex flex-col items-center gap-3">
              <button
                type="button"
                className="btn-secondary w-[90%] px-4 py-3 text-left"
                onClick={() => {
                  setIsMenuModalOpen(false)
                  onOpenNewGame?.()
                }}
              >
                New Game
              </button>
              <button
                type="button"
                className="btn-secondary w-[90%] px-4 py-3 text-left"
                onClick={() => {
                  onOpenJoinGame?.()
                }}
              >
                Join Game
              </button>
              {isOwner ? (
                <button
                  type="button"
                  className="btn-secondary w-[90%] px-4 py-3 text-left"
                  onClick={() => {
                    setIsMenuModalOpen(false)
                    setIsResetConfirmModalOpen(true)
                  }}
                >
                  Reset Game
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-danger btn-danger-soft w-[90%] px-4 py-3 text-left disabled:opacity-50"
                  onClick={() => {
                    setIsMenuModalOpen(false)
                    onLeaveGame?.()
                  }}
                  disabled={isLeavingGame}
                >
                  {isLeavingGame ? "Leaving..." : "Leave Game"}
                </button>
              )}
              <button
                type="button"
                className="btn-secondary w-[90%] px-4 py-3 text-left"
                onClick={() => {
                  setIsMenuModalOpen(false)
                  onOpenHelp?.()
                }}
              >
                Help
              </button>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                className="btn-secondary px-4 py-2 text-sm"
                onClick={() => setIsMenuModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {isResetConfirmModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-4"
          onClick={() => setIsResetConfirmModalOpen(false)}
        >
          <div
            className="dialog-surface max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-6 text-left"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-xl font-semibold text-white">Reset Game?</h2>
            <p className="mt-3 text-sm text-muted">
              This will erase the current game progress, send everyone back to the lobby, and restart from round 1.
            </p>
            <p className="text-danger-soft mt-2 text-sm">
              This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                className="btn-secondary px-4 py-2"
                onClick={() => setIsResetConfirmModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger btn-danger-soft px-4 py-2"
                onClick={() => {
                  setIsResetConfirmModalOpen(false)
                  onStartOver?.()
                }}
              >
                Reset Game
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
    </div>
  )
}

export default function App() {
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
  const [isLeavingGame, setIsLeavingGame] = useState(false)
  const [isStartingOver, setIsStartingOver] = useState(false)
  const [isEndOfRoundModalDismissed, setIsEndOfRoundModalDismissed] = useState(false)
  const [persistedEndOfRoundSummary, setPersistedEndOfRoundSummary] = useState(null)
  const [pendingPlayerActionId, setPendingPlayerActionId] = useState('')
    const [isShareLinkCopied, setIsShareLinkCopied] = useState(false)
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false)
  const [helpSection, setHelpSection] = useState('how-to-play')
  const [reactionCooldownUntil, setReactionCooldownUntil] = useState(0)
  const aiPauseUntilRef = useRef(0)
  const aiPauseTimeoutRef = useRef(null)
  const previousCompletedTrickCountRef = useRef(0)
  const latestShownRoundIndexRef = useRef(-1)
  const hydratedRoundSummaryGameIdRef = useRef('')
  const gameErrorTimeoutRef = useRef(null)
  const shareLinkCopiedTimeoutRef = useRef(null)
  const reactionCooldownTimeoutRef = useRef(null)
  const endOfRoundSummaryTimeoutRef = useRef(null)
  const gameOverScoreTimeoutRef = useRef(null)
  const isMutationInFlight =
    isStartingGame || isDealingCards || isSubmittingBid || isPlayingCard || isSendingReaction || isSortingCards || isLeavingGame || isStartingOver
  const isReactionOnCooldown = reactionCooldownUntil > Date.now()

  const getRestoredPlayerName = (restoredSession, fallbackName = '') => {
    if (fallbackName) {
      return fallbackName
    }

    if (!restoredSession?.game) {
      return ''
    }

    if (restoredSession.role === 'owner') {
      const ownerPlayerId = restoredSession.ownerPlayerId
      return restoredSession.game.players?.find((player) => player.id === ownerPlayerId)?.name ?? ''
    }

    const viewerPlayerId = getViewerHand(restoredSession.game)?.playerId
    return restoredSession.game.players?.find((player) => player.id === viewerPlayerId)?.name ?? ''
  }

  useEffect(() => () => {
    if (shareLinkCopiedTimeoutRef.current) {
      clearTimeout(shareLinkCopiedTimeoutRef.current)
      shareLinkCopiedTimeoutRef.current = null
    }
    if (reactionCooldownTimeoutRef.current) {
      clearTimeout(reactionCooldownTimeoutRef.current)
      reactionCooldownTimeoutRef.current = null
    }
    if (endOfRoundSummaryTimeoutRef.current) {
      clearTimeout(endOfRoundSummaryTimeoutRef.current)
      endOfRoundSummaryTimeoutRef.current = null
    }
    if (gameOverScoreTimeoutRef.current) {
      clearTimeout(gameOverScoreTimeoutRef.current)
      gameOverScoreTimeoutRef.current = null
    }
  }, [])

  const handleRemovedFromGame = (gameId, message = "You have been removed from game " + gameId + ".") => {
    if (gameId) {
      clearStoredGameSession(gameId)
    }

    if (aiPauseTimeoutRef.current) {
      clearTimeout(aiPauseTimeoutRef.current)
      aiPauseTimeoutRef.current = null
    }

    if (gameErrorTimeoutRef.current) {
      clearTimeout(gameErrorTimeoutRef.current)
      gameErrorTimeoutRef.current = null
    }
    if (endOfRoundSummaryTimeoutRef.current) {
      clearTimeout(endOfRoundSummaryTimeoutRef.current)
      endOfRoundSummaryTimeoutRef.current = null
    }
    if (gameOverScoreTimeoutRef.current) {
      clearTimeout(gameOverScoreTimeoutRef.current)
      gameOverScoreTimeoutRef.current = null
    }

    aiPauseUntilRef.current = 0
    previousCompletedTrickCountRef.current = 0
    latestShownRoundIndexRef.current = -1
    hydratedRoundSummaryGameIdRef.current = ''
    setOwnerSession(null)
    setPlayerSession(null)
    setGameError('')
    setLobbyInfo('')
    setPersistedEndOfRoundSummary(null)
    setIsEndOfRoundModalDismissed(false)
    setIsBidModalOpen(false)
    setSessionInfo(null)
    setRequestError(message)
    clearGameIdInUrl()
  }

  useEffect(() => {
    const gameIdFromUrl = getGameIdFromUrl()
    if (!gameIdFromUrl) {
      return undefined
    }

    let isCancelled = false
    setJoinGameId(gameIdFromUrl)

    const attemptSessionRestore = async () => {
      const storedSession = getStoredGameSession(gameIdFromUrl)
      if (!storedSession?.playerToken) {
        if (!isCancelled) {
          setIsJoinModalOpen(true)
        }
        return
      }

      const restoredSession = await normalizeStoredSessionGame(
        gameIdFromUrl,
        storedSession.playerToken,
        storedSession.role,
      )

      if (isCancelled) {
        return
      }

      if (restoredSession?.role === 'owner') {
        setOwnerSession({
          gameId: gameIdFromUrl,
          playerToken: storedSession.playerToken,
          game: restoredSession.game,
          ownerPlayerId: restoredSession.ownerPlayerId,
        })
        setSelectedMaxCards(String(restoredSession.game?.options?.maxCards ?? 10))
        setSelectedAiDifficulty(restoredSession.game?.options?.aiDifficulty ?? 'medium')
        setPlayerSession(null)
        setIsJoinModalOpen(false)
        saveStoredGameSession(
          gameIdFromUrl,
          storedSession.playerToken,
          'owner',
          getRestoredPlayerName(restoredSession, storedSession.playerName ?? ''),
        )
        return
      }

      if (restoredSession?.role === 'player') {
        setPlayerSession({
          gameId: gameIdFromUrl,
          playerToken: storedSession.playerToken,
          game: restoredSession.game,
          version: restoredSession.version,
        })
        setOwnerSession(null)
        setIsJoinModalOpen(false)
        saveStoredGameSession(
          gameIdFromUrl,
          storedSession.playerToken,
          'player',
          getRestoredPlayerName(restoredSession, storedSession.playerName ?? ''),
        )
        return
      }

      clearStoredGameSession(gameIdFromUrl)
      if (!isCancelled) {
        if (storedSession?.role === 'player') {
          handleRemovedFromGame(gameIdFromUrl)
        } else {
          setIsJoinModalOpen(true)
        }
      }
    }

    attemptSessionRestore()

    return () => {
      isCancelled = true
    }
  }, [])

  useEffect(() => {
    if (ownerSession?.gameId || playerSession?.gameId) {
      return undefined
    }

    if (getGameIdFromUrl()) {
      return undefined
    }

    let isCancelled = false

    const loadRejoinableGames = async () => {
      setIsLoadingRejoinGames(true)

      const storedSessions = await pruneMissingStoredGameSessions()
      const gameIds = Object.keys(storedSessions)

      if (gameIds.length === 0) {
        if (!isCancelled) {
          setRejoinableGames([])
          setSelectedRejoinGameId('')
          setIsLoadingRejoinGames(false)
        }
        return
      }

      const resolvedSessions = await Promise.all(
        gameIds.map(async (gameId) => {
          const storedSession = storedSessions[gameId]
          if (typeof storedSession?.playerToken !== 'string' || !storedSession.playerToken.trim()) {
            return null
          }

          const normalized = await normalizeStoredSessionGame(
            gameId,
            storedSession.playerToken,
            storedSession.role,
          )
          if (!normalized?.game || normalized.game.phase?.stage === 'GameOver') {
            return null
          }

          return {
            gameId,
            playerToken: storedSession.playerToken,
            playerName: getRestoredPlayerName(normalized, storedSession.playerName ?? ''),
            phase: normalized.game.phase?.stage ?? 'Unknown',
            role: normalized.role,
            updatedAt: storedSession.updatedAt ?? 0,
          }
        }),
      )

      if (isCancelled) {
        return
      }

      const nextRejoinableGames = resolvedSessions
        .filter(Boolean)
        .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))

      setRejoinableGames(nextRejoinableGames)
      setSelectedRejoinGameId((current) =>
        current && nextRejoinableGames.some((entry) => entry.gameId === current)
          ? current
          : '',
      )
      setIsLoadingRejoinGames(false)
    }

    loadRejoinableGames()

    return () => {
      isCancelled = true
    }
  }, [ownerSession?.gameId, playerSession?.gameId])

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

  const handleCreateGame = async (event) => {
    event.preventDefault()
    const errors = {}
    const trimmedPlayerName = playerName.trim()
    const playerNameError = validatePlayerName(playerName)

    if (playerNameError) {
      errors.playerName = playerNameError
    }

    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors)
      return
    }

    setCreateErrors({})
    setRequestError('')
    setIsCreatingGame(true)

    try {
      const result = await createGame({
        playerName: trimmedPlayerName,
      })
      setSessionInfo({
        action: 'createGame',
        gameId: result?.game?.id,
        playerToken: result?.playerToken,
      })

      setOwnerSession({
        gameId: result?.game?.id,
        playerToken: result?.playerToken,
        game: result?.game,
        ownerPlayerId: result?.game?.players?.find((player) => player.type === 'human')?.id,
      })
      setSelectedMaxCards(String(result?.game?.options?.maxCards ?? 10))
      setSelectedAiDifficulty(result?.game?.options?.aiDifficulty ?? 'medium')
      setPlayerSession(null)
      setGameError('')
      setLobbyInfo('')
      setGameIdInUrl(result?.game?.id)
      saveStoredGameSession(result?.game?.id, result?.playerToken, 'owner', trimmedPlayerName)
      closeCreateModal()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create game'
      setRequestError(message)
    } finally {
      setIsCreatingGame(false)
    }
  }

  const handleJoinGame = async (event) => {
    event.preventDefault()

    if (selectedRejoinGameId) {
      await handleRejoinGame(event)
      return
    }

    const errors = {}
    const trimmedPlayerName = joinPlayerName.trim()
    const playerNameError = validatePlayerName(joinPlayerName)

    if (!joinGameId.trim()) {
      errors.gameId = 'Game ID is required.'
    }

    if (playerNameError) {
      errors.playerName = playerNameError
    }

    if (Object.keys(errors).length > 0) {
      setJoinErrors(errors)
      return
    }

    setJoinErrors({})
    setRequestError('')
    setIsJoiningGame(true)

    try {
      const result = await joinGame({
        gameId: joinGameId.trim(),
        playerName: trimmedPlayerName,
      })
      setSessionInfo({
        action: 'joinGame',
        gameId: result?.game?.id,
        playerToken: result?.playerToken,
      })
      setPlayerSession({
        gameId: result?.game?.id,
        playerToken: result?.playerToken,
        game: result?.game,
        version: result?.version ?? result?.game?.version ?? 0,
      })
      setOwnerSession(null)
      setGameError('')
      setLobbyInfo('')
      setGameIdInUrl(result?.game?.id)
      saveStoredGameSession(result?.game?.id, result?.playerToken, 'player', trimmedPlayerName)
      closeJoinModal()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to join game'
      if (message.toLowerCase().includes('game not found')) {
        setJoinErrors((prev) => ({ ...prev, gameId: 'Game ID does not exist.' }))
        setRequestError('')
      } else {
        setRequestError(message)
      }
    } finally {
      setIsJoiningGame(false)
    }
  }

  const handleRejoinGame = async (event) => {
    event.preventDefault()

    const selectedGame = rejoinableGames.find((game) => game.gameId === selectedRejoinGameId)
    if (!selectedGame?.gameId || !selectedGame.playerToken) {
      return
    }

    setRequestError('')
    setIsRejoiningGame(true)

    try {
      const restoredSession = await normalizeStoredSessionGame(
        selectedGame.gameId,
        selectedGame.playerToken,
        selectedGame.role,
      )

      if (!restoredSession?.game || restoredSession.game.phase?.stage === 'GameOver') {
        throw new Error('Stored game is no longer available to rejoin')
      }

      if (restoredSession.role === 'owner') {
        setOwnerSession({
          gameId: selectedGame.gameId,
          playerToken: selectedGame.playerToken,
          game: restoredSession.game,
          ownerPlayerId: restoredSession.ownerPlayerId,
        })
        setPlayerSession(null)
        saveStoredGameSession(selectedGame.gameId, selectedGame.playerToken, 'owner', selectedGame.playerName ?? '')
      } else {
        setPlayerSession({
          gameId: selectedGame.gameId,
          playerToken: selectedGame.playerToken,
          game: restoredSession.game,
          version: restoredSession.version,
        })
        setOwnerSession(null)
        saveStoredGameSession(selectedGame.gameId, selectedGame.playerToken, 'player', selectedGame.playerName ?? '')
      }

      setSessionInfo({
        action: 'rejoinGame',
        gameId: selectedGame.gameId,
      })
      setGameError('')
      setLobbyInfo('')
      setGameIdInUrl(selectedGame.gameId)
      closeJoinModal()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to rejoin game'
      setRequestError(message)
    } finally {
      setIsRejoiningGame(false)
    }
  }

  const refreshOwnerGame = async () => {
    if (!ownerSession?.gameId || !ownerSession?.playerToken) {
      return
    }

    if (isMutationInFlight) {
      return
    }

    if (Date.now() < aiPauseUntilRef.current) {
      return
    }

    try {
      const result = await checkState({
        gameId: ownerSession.gameId,
        playerToken: ownerSession.playerToken,
      })

      setOwnerSession((prev) => {
        if (!prev) {
          return prev
        }

        return {
          ...prev,
          game: result?.game ?? prev.game,
        }
      })
    } catch (error) {
      const message = toUserFacingActionError(error, 'Unable to refresh game state')
      setGameError(message)
    }
  }

  const refreshPlayerGame = async () => {
    if (!playerSession?.gameId || !playerSession?.playerToken) {
      return
    }

    if (isMutationInFlight) {
      return
    }

    try {
      const result = await getGameState({
        gameId: playerSession.gameId,
        playerToken: playerSession.playerToken,
        version: playerSession.version ?? playerSession.game?.version ?? 0,
      })

      setPlayerSession((prev) => {
        if (!prev) {
          return prev
        }

        return {
          ...prev,
          game: result?.game ?? prev.game,
          version: result?.version ?? prev.version,
        }
      })
    } catch (error) {
      if (isInvalidPlayerTokenError(error)) {
        handleRemovedFromGame(playerSession.gameId)
        return
      }

      const message = toUserFacingActionError(error, 'Unable to refresh game state')
      setGameError(message)
    }
  }

  useEffect(() => {
    if (!ownerSession?.gameId || !ownerSession?.playerToken) {
      return undefined
    }

    refreshOwnerGame()

    const interval = setInterval(() => {
      refreshOwnerGame()
    }, AI_ACTION_DELAY_MS)

    return () => clearInterval(interval)
  }, [ownerSession?.gameId, ownerSession?.playerToken, isMutationInFlight])

  useEffect(() => {
    if (!playerSession?.gameId || !playerSession?.playerToken) {
      return undefined
    }

    refreshPlayerGame()

    const interval = setInterval(() => {
      refreshPlayerGame()
    }, AI_ACTION_DELAY_MS)

    return () => clearInterval(interval)
  }, [playerSession?.gameId, playerSession?.playerToken, playerSession?.version, isMutationInFlight])

  const activeLobbySession = ownerSession ?? playerSession
  const isOwnerLobby = Boolean(ownerSession)
  const activeGame = activeLobbySession?.game
  const activeRoundIndex =
    activeGame?.phase && 'roundIndex' in activeGame.phase ? activeGame.phase.roundIndex : 0
  const currentRoundCardCount = activeGame?.options?.rounds?.[activeRoundIndex]?.cardCount ?? 0
  const isTripRound = [1, 2, 3].includes(currentRoundCardCount)
  const completedRoundCount = getCompletedRoundCount(activeGame)

  useEffect(() => {
    if (!activeGame) {
      return
    }

    if (hydratedRoundSummaryGameIdRef.current === activeGame.id) {
      return
    }

    hydratedRoundSummaryGameIdRef.current = activeGame.id
    latestShownRoundIndexRef.current = completedRoundCount > 0 ? completedRoundCount - 1 : -1
    setPersistedEndOfRoundSummary(
      completedRoundCount > 0 ? buildRoundSummary(activeGame, completedRoundCount - 1) : null,
    )
    setIsEndOfRoundModalDismissed(true)
  }, [activeGame, completedRoundCount])

  useEffect(() => {
    if (gameErrorTimeoutRef.current) {
      clearTimeout(gameErrorTimeoutRef.current)
      gameErrorTimeoutRef.current = null
    }

    if (!gameError || activeGame?.phase?.stage !== 'Playing') {
      return
    }

    gameErrorTimeoutRef.current = setTimeout(() => {
      setGameError('')
      gameErrorTimeoutRef.current = null
    }, 2000)

    return () => {
      if (gameErrorTimeoutRef.current) {
        clearTimeout(gameErrorTimeoutRef.current)
        gameErrorTimeoutRef.current = null
      }
    }
  }, [activeGame?.phase?.stage, gameError])

  useEffect(() => {
    if (!activeGame || completedRoundCount <= 0) {
      return
    }

    const latestCompletedRoundIndex = completedRoundCount - 1
    if (latestCompletedRoundIndex <= latestShownRoundIndexRef.current) {
      return
    }

    const summary = buildRoundSummary(activeGame, latestCompletedRoundIndex)
    if (!summary) {
      return
    }

    latestShownRoundIndexRef.current = latestCompletedRoundIndex
    setPersistedEndOfRoundSummary(summary)

    if (endOfRoundSummaryTimeoutRef.current) {
      clearTimeout(endOfRoundSummaryTimeoutRef.current)
      endOfRoundSummaryTimeoutRef.current = null
    }

    if (activeGame.phase?.stage === 'GameOver') {
      setIsEndOfRoundModalDismissed(true)
      return
    }

    setIsEndOfRoundModalDismissed(true)
    endOfRoundSummaryTimeoutRef.current = setTimeout(() => {
      setIsEndOfRoundModalDismissed(false)
      endOfRoundSummaryTimeoutRef.current = null
    }, TRICK_COMPLETE_DELAY_MS)

    return () => {
      if (endOfRoundSummaryTimeoutRef.current) {
        clearTimeout(endOfRoundSummaryTimeoutRef.current)
        endOfRoundSummaryTimeoutRef.current = null
      }
    }
  }, [activeGame, completedRoundCount])

  const orderedPlayers = useMemo(() => {
    const game = activeLobbySession?.game
    if (!game) {
      return []
    }

    const playersById = new Map((game.players ?? []).map((player) => [player.id, player]))
    return (game.playerOrder ?? [])
      .map((playerId) => playersById.get(playerId))
      .filter(Boolean)
  }, [activeLobbySession?.game])

  const shareLink = useMemo(() => {
    if (!activeLobbySession?.gameId || typeof window === 'undefined') {
      return ''
    }

    const url = new URL(window.location.href)
    url.searchParams.set('gameid', activeLobbySession.gameId)
    url.searchParams.delete('gameId')
    return url.toString()
  }, [activeLobbySession?.gameId])

  useEffect(() => {
    return () => {
      if (aiPauseTimeoutRef.current) {
        clearTimeout(aiPauseTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const completedTricks =
      activeGame?.phase && 'cards' in activeGame.phase ? activeGame.phase.cards.completedTricks ?? [] : []

    if (!ownerSession?.gameId || !activeGame) {
      previousCompletedTrickCountRef.current = completedTricks.length
      aiPauseUntilRef.current = 0
      return
    }

    const trickCountIncreased = completedTricks.length > previousCompletedTrickCountRef.current
    previousCompletedTrickCountRef.current = completedTricks.length

    if (!trickCountIncreased) {
      return
    }

    aiPauseUntilRef.current = Date.now() + TRICK_COMPLETE_DELAY_MS
    if (aiPauseTimeoutRef.current) {
      clearTimeout(aiPauseTimeoutRef.current)
    }
    aiPauseTimeoutRef.current = setTimeout(() => {
      aiPauseUntilRef.current = 0
      aiPauseTimeoutRef.current = null
      refreshOwnerGame()
    }, TRICK_COMPLETE_DELAY_MS)
  }, [activeGame, ownerSession?.gameId])

  const handleCopyShareLink = async () => {
    if (!shareLink) {
      return
    }

    try {
      await navigator.clipboard.writeText(shareLink)
      setIsShareLinkCopied(true)
      if (shareLinkCopiedTimeoutRef.current) {
        clearTimeout(shareLinkCopiedTimeoutRef.current)
      }
      shareLinkCopiedTimeoutRef.current = setTimeout(() => {
        setIsShareLinkCopied(false)
        shareLinkCopiedTimeoutRef.current = null
      }, 2000)
    } catch {
      setLobbyInfo('Unable to copy automatically. Copy the link manually.')
    }
  }

  const handleMovePlayer = async (playerId, direction) => {
    if (!ownerSession?.gameId || !ownerSession?.playerToken) {
      return
    }

    setGameError('')
    setLobbyInfo('')
    setPendingPlayerActionId(playerId)

    try {
      const result = await movePlayer({
        gameId: ownerSession.gameId,
        playerToken: ownerSession.playerToken,
        playerId,
        direction,
      })
      setOwnerSession((prev) =>
        prev
          ? {
              ...prev,
              game: result?.game ?? prev.game,
            }
          : prev,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to move player'
      setGameError(message)
    } finally {
      setPendingPlayerActionId('')
    }
  }

  const handleRemovePlayer = async (playerId) => {
    if (!ownerSession?.gameId || !ownerSession?.playerToken) {
      return false
    }

    setGameError('')
    setLobbyInfo('')
    setPendingPlayerActionId(playerId)

    try {
      const result = await removePlayer({
        gameId: ownerSession.gameId,
        playerToken: ownerSession.playerToken,
        playerId,
      })
      setOwnerSession((prev) =>
        prev
          ? {
              ...prev,
              game: result?.game ?? prev.game,
            }
          : prev,
      )
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to remove player'
      setGameError(message)
      return false
    } finally {
      setPendingPlayerActionId('')
    }
  }

  const handleLeaveGame = async () => {
    if (!playerSession?.gameId || !playerSession?.playerToken) {
      return false
    }

    const leavingPlayerId =
      playerSession.game?.phase && 'cards' in playerSession.game.phase
        ? playerSession.game.phase.cards.hands?.[0]?.playerId
        : ''

    if (!leavingPlayerId) {
      setGameError('Unable to determine which player should leave this game')
      return false
    }

    setGameError('')
    setLobbyInfo('')
    setRequestError('')
    setSessionInfo(null)
    setIsLeavingGame(true)

    try {
      await removePlayer({
        gameId: playerSession.gameId,
        playerToken: playerSession.playerToken,
        playerId: leavingPlayerId,
      })
      clearGameIdInUrl()
      setSessionInfo(null)
      handleRemovedFromGame(playerSession.gameId, "You left game " + playerSession.gameId + ".")
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to leave game'
      setGameError(message)
      return false
    } finally {
      setIsLeavingGame(false)
    }
  }

  const handleStartGame = async () => {
    if (!ownerSession?.gameId || !ownerSession?.playerToken) {
      return
    }

    setGameError('')
    setLobbyInfo('')
    setIsStartingGame(true)

    try {
      const result = await startGame({
        gameId: ownerSession.gameId,
        playerToken: ownerSession.playerToken,
        maxCards: Number(selectedMaxCards),
        dealerPlayerId: orderedPlayers[0]?.id || undefined,
        aiDifficulty: selectedAiDifficulty,
      })
      setOwnerSession((prev) =>
        prev
          ? {
              ...prev,
              game: result?.game ?? prev.game,
            }
          : prev,
      )
      setLobbyInfo('Game started.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start game'
      setGameError(message)
    } finally {
      setIsStartingGame(false)
    }
  }

  const resetActiveSessionState = () => {
    if (aiPauseTimeoutRef.current) {
      clearTimeout(aiPauseTimeoutRef.current)
      aiPauseTimeoutRef.current = null
    }

    aiPauseUntilRef.current = 0
    previousCompletedTrickCountRef.current = 0
    latestShownRoundIndexRef.current = -1
    hydratedRoundSummaryGameIdRef.current = ''
    if (gameErrorTimeoutRef.current) {
      clearTimeout(gameErrorTimeoutRef.current)
      gameErrorTimeoutRef.current = null
    }
    if (endOfRoundSummaryTimeoutRef.current) {
      clearTimeout(endOfRoundSummaryTimeoutRef.current)
      endOfRoundSummaryTimeoutRef.current = null
    }
    if (gameOverScoreTimeoutRef.current) {
      clearTimeout(gameOverScoreTimeoutRef.current)
      gameOverScoreTimeoutRef.current = null
    }
    setOwnerSession(null)
    setPlayerSession(null)
    setGameError('')
    setLobbyInfo('')
    setSessionInfo(null)
    setPersistedEndOfRoundSummary(null)
    setIsEndOfRoundModalDismissed(false)
    clearGameIdInUrl()
  }

  const handleStartOver = async () => {
    if (!ownerSession?.gameId || !ownerSession?.playerToken) {
      return
    }

    setGameError('')
    setLobbyInfo('')
    setIsStartingOver(true)

    try {
      const result = await startOver({
        gameId: ownerSession.gameId,
        playerToken: ownerSession.playerToken,
      })

      setOwnerSession((prev) =>
        prev
          ? {
              ...prev,
              game: result?.game ?? prev.game,
            }
          : prev,
      )
      setSelectedMaxCards(String(result?.game?.options?.maxCards ?? 10))
      setSelectedAiDifficulty(result?.game?.options?.aiDifficulty ?? 'medium')
      setLobbyInfo('Game reset to lobby.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start over'
      setGameError(message)
    } finally {
      setIsStartingOver(false)
    }
  }

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

  const handleDealCards = async () => {
    const activeSession = ownerSession ?? playerSession
    if (!activeSession?.gameId || !activeSession?.playerToken) {
      return
    }

    setGameError('')
    setLobbyInfo('')
    setIsDealingCards(true)

    try {
      const result = await dealCards({
        gameId: activeSession.gameId,
        playerToken: activeSession.playerToken,
      })

      if (ownerSession) {
        setOwnerSession((prev) =>
          prev
            ? {
                ...prev,
                game: result?.game ?? prev.game,
              }
            : prev,
        )
      } else {
        setPlayerSession((prev) =>
          prev
            ? {
                ...prev,
                game: result?.game ?? prev.game,
                version: result?.version ?? prev.version,
              }
            : prev,
        )
      }
    } catch (error) {
      const message = toUserFacingActionError(error, 'Unable to deal cards')
      setGameError(message)
    } finally {
      setIsDealingCards(false)
    }
  }

  const openSubmitBidModal = () => {
    setSelectedBid('0')
    setIsBidModalOpen(true)
  }

  const closeSubmitBidModal = () => {
    setIsBidModalOpen(false)
    setSelectedBid('0')
  }

  const handleSubmitBid = async (event) => {
    event.preventDefault()

    const activeSession = ownerSession ?? playerSession
    if (!activeSession?.gameId || !activeSession?.playerToken) {
      return
    }

    setGameError('')
    setLobbyInfo('')
    setIsSubmittingBid(true)

    try {
      const isTripBid = selectedBid === 'trip'
      const result = await submitBid({
        gameId: activeSession.gameId,
        playerToken: activeSession.playerToken,
        bid: isTripBid ? currentRoundCardCount : Number(selectedBid),
        ...(isTripBid ? { trip: true } : {}),
      })

      if (ownerSession) {
        setOwnerSession((prev) =>
          prev
            ? {
                ...prev,
                game: result?.game ?? prev.game,
              }
            : prev,
        )
      } else {
        setPlayerSession((prev) =>
          prev
            ? {
                ...prev,
                game: result?.game ?? prev.game,
                version: result?.version ?? prev.version,
              }
            : prev,
        )
      }

      closeSubmitBidModal()
    } catch (error) {
      const message = toUserFacingActionError(error, 'Unable to submit bid')
      setGameError(message)
    } finally {
      setIsSubmittingBid(false)
    }
  }

  const handleSortCards = async (mode) => {
    const activeSession = ownerSession ?? playerSession
    const activeGame = activeSession?.game
    if (!activeSession?.gameId || !activeSession?.playerToken || activeGame?.phase?.stage === 'Dealing') {
      return
    }

    setGameError('')
    setLobbyInfo('')
    setIsSortingCards(true)

    try {
      const result = await sortCards({
        gameId: activeSession.gameId,
        playerToken: activeSession.playerToken,
        mode,
      })

      if (ownerSession) {
        setOwnerSession((prev) =>
          prev
            ? {
                ...prev,
                game: result?.game ?? prev.game,
              }
            : prev,
        )
      } else {
        setPlayerSession((prev) =>
          prev
            ? {
                ...prev,
                game: result?.game ?? prev.game,
                version: result?.version ?? prev.version,
              }
            : prev,
        )
      }

      setSortMode(mode)
    } catch (error) {
      const message = toUserFacingActionError(error, 'Unable to sort cards')
      setGameError(message)
    } finally {
      setIsSortingCards(false)
    }
  }

  const toggleSortCards = () => {
    void handleSortCards(sortMode === 'bySuit' ? 'byRank' : 'bySuit')
  }

  const handleSendReaction = async (emoji) => {
    const activeSession = ownerSession ?? playerSession
    if (!activeSession?.gameId || !activeSession?.playerToken || isReactionOnCooldown) {
      return
    }

    setGameError('')
    setIsSendingReaction(true)

    try {
      const result = await sendReaction({
        gameId: activeSession.gameId,
        playerToken: activeSession.playerToken,
        emoji,
      })

      if (ownerSession) {
        setOwnerSession((prev) =>
          prev
            ? {
                ...prev,
                game: result?.game ?? prev.game,
              }
            : prev,
        )
      } else {
        setPlayerSession((prev) =>
          prev
            ? {
                ...prev,
                game: result?.game ?? prev.game,
                version: result?.version ?? prev.version,
              }
            : prev,
        )
      }

      const nextCooldownUntil = Date.now() + REACTION_COOLDOWN_MS
      setReactionCooldownUntil(nextCooldownUntil)
      if (reactionCooldownTimeoutRef.current) {
        clearTimeout(reactionCooldownTimeoutRef.current)
      }
      reactionCooldownTimeoutRef.current = setTimeout(() => {
        setReactionCooldownUntil(0)
        reactionCooldownTimeoutRef.current = null
      }, REACTION_COOLDOWN_MS)
    } catch (error) {
      const message = toUserFacingActionError(error, 'Unable to send reaction')
      setGameError(message)
      throw error
    } finally {
      setIsSendingReaction(false)
    }
  }

  const handleRenamePlayer = async (playerName, playerId) => {
    const activeSession = ownerSession ?? playerSession
    if (!activeSession?.gameId || !activeSession?.playerToken) {
      return false
    }

    setGameError('')
    setLobbyInfo('')
    setIsRenamingPlayer(true)

    try {
      const result = await renamePlayer({
        gameId: activeSession.gameId,
        playerToken: activeSession.playerToken,
        playerName,
        playerId,
      })

      if (ownerSession) {
        setOwnerSession((prev) =>
          prev
            ? {
                ...prev,
                game: result?.game ?? prev.game,
              }
            : prev,
        )
      } else {
        setPlayerSession((prev) =>
          prev
            ? {
                ...prev,
                game: result?.game ?? prev.game,
                version: result?.version ?? prev.version,
              }
            : prev,
        )
      }

      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update player name'
      setGameError(message)
      return false
    } finally {
      setIsRenamingPlayer(false)
    }
  }

  const handlePlayCard = async (card) => {
    const activeSession = ownerSession ?? playerSession
    const activeGame = activeSession?.game
    if (!activeSession?.gameId || !activeSession?.playerToken || !activeGame) {
      return
    }

    setGameError('')
    setLobbyInfo('')
    setIsPlayingCard(true)

    try {
      const result = await playCard({
        gameId: activeSession.gameId,
        playerToken: activeSession.playerToken,
        card,
      })

      if (ownerSession) {
        setOwnerSession((prev) =>
          prev
            ? {
                ...prev,
                game: result?.game ?? prev.game,
              }
            : prev,
        )
      } else {
        setPlayerSession((prev) =>
          prev
            ? {
                ...prev,
                game: result?.game ?? prev.game,
                version: result?.version ?? prev.version,
              }
            : prev,
        )
      }
    } catch (error) {
      const message = toUserFacingActionError(error, 'Unable to play card')
      setGameError(message)
    } finally {
      setIsPlayingCard(false)
    }
  }

  const currentDealerPlayerId = ownerSession?.game?.phase?.dealerPlayerId ?? orderedPlayers[0]?.id ?? ''
  const helpModal = isHelpModalOpen ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 px-4 py-4"
      onClick={() => setIsHelpModalOpen(false)}
    >
      <div
        className="dialog-surface flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden p-6 text-left"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Welcome to Setback</h2>
        </div>
        <div className="divider mt-4 flex gap-2 border-b pb-4">
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              helpSection === 'how-to-play'
                ? 'bg-white text-slate-900'
                : 'badge-subtle border text-muted hover:text-white'
            }`}
            onClick={() => setHelpSection('how-to-play')}
          >
            How to Play
          </button>
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              helpSection === 'using-app'
                ? 'bg-white text-slate-900'
                : 'badge-subtle border text-muted hover:text-white'
            }`}
            onClick={() => setHelpSection('using-app')}
          >
            Using the App
          </button>
        </div>
        <div className="score-scroll mt-4 min-h-0 flex-1 overflow-auto pr-1 text-sm text-muted">
          {helpSection === 'using-app' ? (
            <>
              <section>
                <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-dim">Getting Started</h4>
                <div className="mt-4">
                  <h5 className="text-sm font-semibold text-white">New Game</h5>
                  <p className="mt-2">
                    When creating a new game, a user is prompted to enter their name. After the game is created, that user becomes
                    the game owner and enters the Lobby.
                  </p>
                </div>
                <div className="mt-4">
                  <h5 className="text-sm font-semibold text-white">Join Game</h5>
                  <p className="mt-2">
                    Users can join an existing game by clicking Join Game and entering the game ID along with their name. Users may
                    also use a shared link, given to them by other players. Using a shared link will populate the game ID for them.
                  </p>
                </div>
              </section>
              <section className="mt-4">
                <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-dim">The Lobby</h4>
                <p className="mt-2">
                  The lobby is where players gather before the game begins. The owner can share the game link or game ID with others so
                  more players can join in. The game will always have a full amount of players by filling empty seats with AI players. When
                  someone else joins, that player will take the seat of an AI player.
                </p>
                <div className="mt-2">
                  <p>Game owners can do the following before the game starts:</p>
                  <ul className="mt-2 ml-4 list-disc space-y-1 pl-5">
                    <li>Adjust the seating order to control turn order and dealer rotation.</li>
                    <li>Remove human players from the game, which returns their seat to an AI player.</li>
                    <li>Choose Max Cards, which sets the largest hand size used in the round sequence.</li>
                    <li>Choose which player deals first when the game begins.</li>
                  </ul>
                </div>
                <p className="mt-2">
                  For other players, the lobby is mainly a waiting area. They can watch other players join. As others join, they will take
                  the seat of any AI players in the game. Players remain in the Lobby until the game owner starts the game.
                </p>
              </section>
              <section className="mt-4">
                <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-dim">During the Game</h4>
                <p className="mt-2">
                  During the game, the main table shows the current round, score, tricks, trump, and your hand. Action buttons appear
                  based on the current phase, such as dealing, bidding, playing a card, sorting your hand, or starting over when the
                  game is finished.
                </p>
                <p className="mt-2">
                  The score area keeps track of bids, books, total score, and dealer position so players can quickly see how the round
                  is unfolding.
                </p>
              </section>
              <section className="mt-4">
                <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-dim">Game Menu</h4>
                <p className="mt-2">
                  The game menu can be opened during play to access common actions. From there, players can review their name, copy the
                  game link from the game ID button, start a new game, join another game, switch to a stored game, or open this Help panel.
                </p>
                <p className="mt-2">
                  The game owner also has access to owner-only actions like resetting the current game when appropriate.
                </p>
              </section>
            </>
          ) : (
            <>
              <section>
                <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-dim">Objective</h4>
                <p className="mt-2">
                  Score as many points as you can by making smart bids, winning tricks, and earning special bonuses.
                  When all rounds are complete, the player with the highest total score wins.
                </p>
              </section>

              <section className="mt-4">
                <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-dim">Playing The Game</h4>
                <p className="mt-2">
                  The game is played in a sequence of rounds based on the chosen maximum hand size. Rounds count down
                  from the max to 1, then climb back up to the max again. For example, a 10‑card game plays
                  10, 9, 8 … 1, 2 … 10.
                </p>

                <div className="mt-4">
                  <h5 className="text-sm font-semibold text-white">Dealing</h5>
                  <p className="mt-2">
                    The dealer deals one card at a time to each player until everyone has the correct number of cards
                    for the round. After dealing, the dealer flips a card face‑up to set the trump suit for the round.
                    If the card is a joker, it's placed under the deck and another card is turned over to set the trump
                    suit.
                  </p>
                </div>

                <div className="mt-4">
                  <h5 className="text-sm font-semibold text-white">Bidding</h5>
                  <p className="mt-2">
                    Starting with the player to the dealer&apos;s left, each player makes a bid. You may bid any number
                    from 0 up to the number of cards in the round.
                  </p>
                  <p className="mt-2">
                    In 3‑card, 2‑card, and 1‑card rounds, players may also bid <span className="text-white">Trip</span>,
                    declaring they intend to win every trick in that round. Tripping triples the scoring for the round:
                    winning all tricks earns a triple bonus, but failing to win them all results in a triple penalty.
                  </p>
                </div>

                <div className="mt-4">
                  <h5 className="text-sm font-semibold text-white">Playing a Round</h5>
                  <p className="mt-2">
                    Each round consists of several tricks—one trick for every card in your hand. Your goal is to win enough
                    tricks to meet your bid, but you’re also trying to prevent other players from meeting theirs. Forcing
                    someone to miss their bid sets them back, which is where the game gets its name. The player who wins
                    a trick leads the next one, so momentum can shift quickly. Think of a round as a series of small battles,
                    each one giving you a chance to move closer to your bid while pushing others off course.
                  </p>
                </div>

                <div className="mt-4">
                  <h5 className="text-sm font-semibold text-white">Playing a Trick</h5>
                  <p className="mt-2">
                    A trick is a single turn where each player plays one card. After all players have played, one player wins
                    the trick based on the rules below. When a trick is won, it becomes a “book,” and the winner of that book
                    leads the next trick.
                  </p>

                  <p className="mt-2">
                    The first trick is led by the first player after the dealer among those who made the highest bid.
                    The card they play sets the <span className="text-white">lead suit</span>, and all players must follow
                    that suit if they can.
                  </p>

                  <p className="mt-2">
                    If you cannot follow suit, you may play any card. This includes <span className="text-white">trump</span>,
                    which acts like a powerful wild suit. Jokers count as trump. Trump cannot be led until it has been
                    broken—meaning someone has played trump because they couldn&apos;t follow suit—unless your entire hand
                    is trump.
                  </p>

                  <p className="mt-2">
                    A trick is won by the highest trump played. If no trump is played, the highest card in the lead suit
                    wins. Big Joker is highest, followed by Little Joker, then trump cards from Ace down to 2.
                  </p>
                </div>

                <div className="mt-4">
                  <h5 className="text-sm font-semibold text-white">Scoring</h5>
                  <p className="mt-2">
                    If you meet your bid, you earn 10 points per trick you bid, plus 1 extra point for each trick you
                    win beyond your bid. If you miss your bid, you lose 10 points per trick you bid.
                  </p>
                  <p className="mt-2">
                    <span className="text-white">Trip</span> is only available in 3‑card, 2‑card, and 1‑card rounds.
                    A successful Trip—winning every trick—earns 30 points per trick. Failing a Trip costs 30 points per
                    trick instead.
                  </p>
                  <p className="mt-2">
                    In 4‑card rounds, a player receives a <span className="text-white">Rainbow</span> bonus if they are
                    dealt four cards that cover all four suits. Jokers count as the trump suit for this purpose.
                    Achieving a Rainbow awards 25 bonus points.
                  </p>
                </div>

                <div className="mt-4">
                  <h5 className="text-sm font-semibold text-white">Winning The Game</h5>
                  <p className="mt-2">
                    After the final round, scores are totaled. The player with the highest score wins. If players are
                    tied, they share the final standing.
                  </p>
                </div>
              </section>
            </>
          )}
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            className="btn-secondary px-4 py-2 text-sm"
            onClick={() => setIsHelpModalOpen(false)}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  ) : null

  if (activeGame && activeGame.phase?.stage !== 'Lobby') {
    return (
      <>
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

        {isBidModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 px-4 py-4"
            onClick={closeSubmitBidModal}
          >
            <div
              className="dialog-surface max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-6 text-left"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 className="text-xl font-semibold">Bid</h2>
              <form className="mt-4 flex flex-col gap-4" onSubmit={handleSubmitBid}>
                <label className="flex flex-col gap-2">
                  <span className="text-sm text-muted">Bid Amount</span>
                  <select
                    value={selectedBid}
                    onChange={(event) => setSelectedBid(event.target.value)}
                    className="input-surface"
                  >
                    {Array.from({ length: currentRoundCardCount + 1 }, (_, index) => String(index)).map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                    {isTripRound && (
                      <option value="trip">
                        Trip
                      </option>
                    )}
                  </select>
                </label>

                <div className="mt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    className="btn-secondary px-4 py-2"
                    onClick={closeSubmitBidModal}
                    disabled={isSubmittingBid}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary px-4 py-2 disabled:opacity-50"
                    disabled={isSubmittingBid}
                  >
                    {isSubmittingBid ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {persistedEndOfRoundSummary && !isEndOfRoundModalDismissed && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 px-4 py-4"
          >
            <div
              className="dialog-surface max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto p-6 text-left"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 className="text-xl font-semibold">
                {`End of Round ${persistedEndOfRoundSummary.cardCount} ${getRoundDirectionArrow(persistedEndOfRoundSummary.direction)}`}
              </h2>
              <ul className="mt-4 flex flex-col gap-2">
                {persistedEndOfRoundSummary.players.map((player) => {
                  const winningScore = persistedEndOfRoundSummary.players[0]?.score ?? null
                  const isWinner = winningScore !== null && player.score === winningScore

                  return (
                    <li
                      key={player.playerId}
                      className={`rounded-md border px-3 py-3 ${
                        isWinner
                          ? 'winner-surface'
                          : 'panel-surface-strong'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-white">{player.name}</p>
                        <div className="flex items-center gap-4 text-sm text-muted">
                          <span>{`Bid ${player.bid}`}</span>
                          <span>{`Books ${player.books}`}</span>
                          <span className="font-medium text-white">{`Score ${player.score}`}{player.rainbow ? ' 🌈' : ''}</span>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  className="btn-primary px-4 py-2"
                  onClick={() => setIsEndOfRoundModalDismissed(true)}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}
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
        {helpModal}
      </>
    )
  }

  if (activeLobbySession?.gameId && activeLobbySession?.game) {
    return (
      <main className="theme-shell min-h-screen px-4 py-4 sm:py-6">
        <section className="mx-auto flex w-full max-w-5xl flex-col">
          <div className="table-surface rounded-[2rem] border px-4 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)] sm:px-6 sm:py-6">
            <header className="divider flex flex-col gap-2 border-b pb-5">
              <h1 className="text-3xl font-bold tracking-tight">
                {isOwnerLobby ? 'Game Owner Lobby' : 'Game Lobby'}
              </h1>
              <div className="flex flex-wrap gap-3 text-sm">
                <p className="badge-subtle rounded-full border px-3 py-1 text-muted">
                  Game ID:{' '}
                  <span className="text-accent font-medium [text-shadow:0_0_12px_rgba(158,211,180,0.35)]">
                    {activeLobbySession.gameId}
                  </span>
                </p>
                <p className="badge-subtle rounded-full border px-3 py-1 text-muted">
                  Phase: {activeLobbySession.game.phase?.stage}
                </p>
              </div>
            </header>

            <div className="mt-6 flex flex-col gap-6">
              {gameError && (
                <p className="status-error">
                  {gameError}
                </p>
              )}
              {lobbyInfo && (
                <p className="status-info">
                  {lobbyInfo}
                </p>
              )}

              <section className="lobby-panel rounded-2xl border p-4">
                <div className="divider border-b pb-3">
                  <h2 className="text-lg font-semibold">Share Link</h2>
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    className="input-surface w-full cursor-pointer text-left text-sm transition hover:border-white/20"
                    onClick={handleCopyShareLink}
                    aria-label={isShareLinkCopied ? 'Share link copied' : 'Copy share link'}
                    title={isShareLinkCopied ? 'Copied' : 'Copy link'}
                  >
                    {isShareLinkCopied ? 'Copied!' : shareLink}
                  </button>
                </div>
              </section>

              <section className="lobby-panel rounded-2xl border p-4">
                <div className="divider flex items-center justify-between gap-4 border-b pb-3">
                  <h2 className="text-lg font-semibold">Players</h2>
                </div>
                <ul className="mt-3 flex flex-col gap-2">
                  {orderedPlayers.map((player) => {
                    const isPending = pendingPlayerActionId === player.id
                    const isDealer = player.id === currentDealerPlayerId
                    return (
                      <li
                        key={player.id}
                        className={`lobby-panel-strong rounded-xl border px-3 py-3 ${
                          isOwnerLobby
                            ? 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3'
                            : 'flex items-center justify-between gap-3'
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          {player.type === 'ai' ? (
                            <span aria-hidden="true" className="text-sm text-muted">🤖</span>
                          ) : (
                            <span aria-hidden="true" className="text-sm text-muted">👤</span>
                          )}
                          <span className="truncate font-medium">{player.name}</span>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          {isDealer ? (
                            <span className="badge-subtle-strong rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-dim">
                              Dealer
                            </span>
                          ) : null}
                          {isOwnerLobby && (
                            <>
                              <button
                                type="button"
                                className="badge-subtle btn-secondary px-3 py-1.5 text-xl font-black disabled:opacity-50"
                                onClick={() => handleMovePlayer(player.id, 'left')}
                                disabled={isPending || isStartingGame}
                                aria-label={`Move ${player.name} up`}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                className="badge-subtle btn-secondary px-3 py-1.5 text-xl font-black disabled:opacity-50"
                                onClick={() => handleMovePlayer(player.id, 'right')}
                                disabled={isPending || isStartingGame}
                                aria-label={`Move ${player.name} down`}
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                className="btn-danger btn-danger-soft px-3 py-1.5 text-xl font-black disabled:opacity-50"
                                onClick={() => handleRemovePlayer(player.id)}
                                disabled={
                                  player.type === 'ai' ||
                                  player.id === ownerSession?.ownerPlayerId ||
                                  isPending ||
                                  isStartingGame
                                }
                                aria-label={`Remove ${player.name}`}
                              >
                                ×
                              </button>
                            </>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>

              {isOwnerLobby && (
                <section className="lobby-panel rounded-2xl border p-4">
                  <div className="flex flex-col gap-3">
                    <div className="divider border-b pb-3">
                      <h2 className="text-lg font-semibold">Options</h2>
                    </div>
                    <label className="flex items-center justify-end gap-2 text-sm text-muted">
                      <span>Max Cards</span>
                      <select
                        value={selectedMaxCards}
                        onChange={(event) => setSelectedMaxCards(event.target.value)}
                        disabled={isStartingGame || ownerSession.game.phase?.stage !== 'Lobby'}
                        className="input-surface px-3 py-1.5 text-sm disabled:opacity-50"
                        aria-label="Select max cards"
                      >
                        {Array.from({ length: 10 }, (_, index) => {
                          const value = String(10 - index)
                          return (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          )
                        })}
                      </select>
                    </label>
                    <label className="flex items-center justify-end gap-2 text-sm text-muted">
                      <span>AI Difficulty</span>
                      <select
                        value={selectedAiDifficulty}
                        onChange={(event) => setSelectedAiDifficulty(event.target.value)}
                        disabled={isStartingGame || ownerSession.game.phase?.stage !== 'Lobby'}
                        className="input-surface px-3 py-1.5 text-sm capitalize disabled:opacity-50"
                        aria-label="Select AI difficulty"
                      >
                        {AI_DIFFICULTY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </section>
              )}

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  className="btn-secondary px-4 py-2"
                  onClick={resetActiveSessionState}
                >
                  Back
                </button>
                {isOwnerLobby ? (
                  <button
                    type="button"
                    className="btn-primary px-4 py-2 disabled:opacity-50"
                    onClick={handleStartGame}
                    disabled={isStartingGame || ownerSession.game.phase?.stage !== 'Lobby'}
                  >
                    {isStartingGame ? 'Starting...' : 'Start Game'}
                  </button>
                ) : (
                  <p className="badge-subtle rounded-full border px-3 py-1 text-sm text-muted">
                    Waiting for game to start...
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
        {helpModal}
      </main>
    )
  }

  return (
    <main className="theme-shell h-[100dvh] overflow-hidden px-4 py-4">
      <section className="mx-auto flex h-full max-w-xl flex-col items-center justify-center px-2 py-4 text-center sm:py-6">
        <div className="table-surface flex max-h-full w-full flex-col items-center justify-center overflow-hidden rounded-[2rem] border px-6 pb-8 pt-5 sm:pb-10 sm:pt-6 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
        <img
          src="/logo-512x512.png"
          alt="Setback"
          className="mb-4 h-24 w-24 rounded-xl sm:h-28 sm:w-28"
        />
        {requestError && (
          <p className="status-error mb-4 w-full max-w-md">
            {requestError}
          </p>
        )}
        {sessionInfo && (
          <p className="status-info mb-4 w-full max-w-md">
            {sessionInfo.action === 'createGame' ? 'Game created' : 'Joined game'}: {sessionInfo.gameId}
          </p>
        )}
        <div className="flex w-full max-w-xs flex-col gap-3">
          <button
            type="button"
            className="btn-primary px-4 py-2"
            onClick={() => setIsCreateModalOpen(true)}
          >
            New Game
          </button>
          <button
            type="button"
            className="btn-secondary px-4 py-2"
            onClick={() => setIsJoinModalOpen(true)}
          >
            Join Game
          </button>
          <button
            type="button"
            className="btn-secondary px-4 py-2"
            onClick={() => setIsHelpModalOpen(true)}
          >
            Help
          </button>
        </div>
        </div>
      </section>

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
      {helpModal}
    </main>
  )
}
