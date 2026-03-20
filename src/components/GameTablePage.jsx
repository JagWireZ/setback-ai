import { useEffect, useMemo, useRef, useState } from 'react'
import { CardAsset, CardBack } from './Cards'
import { ScoreHistory, ScoreSheet, ScoreSummary } from './Scoreboard'
import {
  REACTION_EMOJIS,
  getBidDisplay,
  getCardLabel,
  getCompletedRoundCount,
  getInvalidPlayMessage,
  getMaxCardsForSeatCount,
  getPlayerName,
  getRoundDirectionArrow,
  sortHandCards,
  getViewerHand,
  hashString,
} from '../utils/gameUi'
import { useGameTablePlayState } from '../hooks/useGameTablePlayState'
import { useGameTableState } from '../hooks/useGameTableState'
import { MAX_PLAYER_NAME_LENGTH, sanitizePlayerNameInput, truncateLabel, validatePlayerName } from '../utils/playerName'
import { getPlayerPresence } from '../utils/playerPresence'

const OWNER_IDLE_TURN_TIMEOUT_MS = 60_000

function HelpIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      <path
        d="M8.75 8.5C8.75 6.35 10.3 5 12.45 5c1.95 0 3.8 1.18 3.8 3.35 0 1.82-1 2.78-2.15 3.6-1.08.77-1.8 1.42-1.8 3.05"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12.3 19v.35" strokeLinecap="round" />
    </svg>
  )
}

function DownloadIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      <path d="M12 4.5v9" />
      <path d="m8.25 10.5 3.75 3.75 3.75-3.75" />
      <path d="M5.25 18.75h13.5" />
    </svg>
  )
}

function ShareIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      <circle cx="7" cy="12" r="2.1" />
      <circle cx="16.5" cy="6.5" r="2.1" />
      <circle cx="16.5" cy="17.5" r="2.1" />
      <path d="M8.9 10.9 14.5 7.7" strokeLinecap="round" />
      <path d="m8.9 13.1 5.6 3.2" strokeLinecap="round" />
    </svg>
  )
}

function LinkIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      <path d="M10.5 13.5 13.5 10.5" strokeLinecap="round" />
      <path d="M8.25 14.25 6.5 16a3 3 0 1 0 4.24 4.24l1.75-1.74" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.75 9.75 17.5 8a3 3 0 0 0-4.24-4.24L11.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

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
  onCoverAwayPlayerTurn,
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
  onInstallApp,
  canInstallApp = false,
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
  const rawViewerHand = getViewerHand(game)
  const trumpSuit = game?.phase && 'cards' in game.phase ? game.phase.cards.trump?.suit : undefined
  const viewerHand = useMemo(() => {
    if (!rawViewerHand) {
      return rawViewerHand
    }

    return {
      ...rawViewerHand,
      cards: sortHandCards(rawViewerHand.cards ?? [], sortMode, trumpSuit),
    }
  }, [rawViewerHand, sortMode, trumpSuit])
  const [mobileActionBarHeight, setMobileActionBarHeight] = useState(0)

  const viewerPlayerId = viewerHand?.playerId
  const actualTurnPlayerId = game?.phase && 'turnPlayerId' in game.phase ? game.phase.turnPlayerId : undefined
  const actualTurnPlayer = actualTurnPlayerId
    ? (game.players ?? []).find((player) => player.id === actualTurnPlayerId)
    : null
  const isAwayTurnPlayer = actualTurnPlayer?.type === 'human' && getPlayerPresence(actualTurnPlayer).away
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
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [isResetConfirmModalOpen, setIsResetConfirmModalOpen] = useState(false)
  const [isLeaveConfirmModalOpen, setIsLeaveConfirmModalOpen] = useState(false)
  const [isEditingPlayerName, setIsEditingPlayerName] = useState(false)
  const [selectedScorePlayerId, setSelectedScorePlayerId] = useState('')
  const [pendingRemovePlayer, setPendingRemovePlayer] = useState(null)
  const [scorePlayerNameDraft, setScorePlayerNameDraft] = useState('')
  const [editedPlayerName, setEditedPlayerName] = useState('')
  const [nowMs, setNowMs] = useState(() => Date.now())
  const mobileActionBarRef = useRef(null)
  const hasAutoOpenedGameOverScoreRef = useRef(false)
  const isViewerActualTurn = Boolean(viewerPlayerId && actualTurnPlayerId && viewerPlayerId === actualTurnPlayerId)
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
  const handCardCount = viewerHand?.cards?.length ?? 0
  const activeReactions = game?.reactions ?? []
  const trickPhraseSeed =
    typeof game?.phase?.trickIndex === 'number'
      ? game.phase.trickIndex
      : -1
  const {
    handleReactionCategorySelect,
    isMenuModalOpen,
    isMobileViewport,
    isReactionModalOpen,
    isShareModalOpen,
    reactionModalPosition,
    reactionPhraseCategories,
    reactionPhraseOptions,
    reactionPickerRef,
    selectedReactionPhraseCategoryId,
    setIsMenuModalOpen,
    setIsReactionModalOpen,
    setIsShareModalOpen,
    shareQrCodeDataUrl,
    viewportWidth,
  } = useGameTableState({
    menuCloseRequestKey,
    onSetGameError,
    shareLink,
    trickPhraseSeed,
  })
  const {
    bookWinnerMessage,
    canSelectCards,
    displayedTrickPlays,
    displayedTurnPlayerId,
    floatingCelebrations,
    getPassiveTrickPlayerLabel,
    handleSelectTrickCard,
    isTrickWinnerRevealVisible,
    isViewerTurnVisible,
    leadTrickPlayerId,
    passiveTrickLabelStyles,
    returningTrickLabel,
    selectedCard,
    selectedCardIndex,
    selectedTrickCardIndex,
    selectedTrickLabelRef,
    selectedTrickLabelStyle,
    setSelectedCardIndex,
    trickCardButtonRefs,
    trickPlayCount,
    trickSurfaceRef,
  } = useGameTablePlayState({
    actualTurnPlayerId,
    completedTricks,
    currentTrick,
    game,
    isMobileViewport,
    mobileActionBarHeight,
    orderedPlayers,
    viewerHand,
    viewerPlayerId,
    viewportWidth,
  })
  const currentPlayerName = getPlayerName(game, viewerPlayerId)
  const selectedScorePlayer =
    orderedPlayers.find((player) => player.id === selectedScorePlayerId) ??
    game.players?.find((player) => player.id === selectedScorePlayerId) ??
    null
  const totalTrickPlayers = orderedPlayers.length > 0 ? orderedPlayers.length : (game.playerOrder?.length ?? game.players?.length ?? 0)
  const emojiReactionLayouts = useMemo(
    () =>
      activeReactions
        .filter((reaction) => reaction.emoji)
        .map((reaction, index) => {
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
  const phraseReactionLayouts = useMemo(
    () =>
      activeReactions
        .filter((reaction) => reaction.phrase)
        .slice(-3)
        .map((reaction, index) => {
        const hash = hashString(reaction.id)
        const driftDirection = hash % 2 === 0 ? 1 : -1
        const driftA = driftDirection * (16 + ((hash >> 3) % 10))
        const driftB = driftDirection * -1 * (10 + ((hash >> 6) % 10))
        const delay = index * 0.06

        return {
          reaction,
          style: {
            left: '50%',
            top: `${28 + index * 84}px`,
            animationDelay: `${delay}s`,
            '--reaction-sway-a': `${driftA}px`,
            '--reaction-sway-b': `${driftB}px`,
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

  const trickLayout = useMemo(() => {
    const availableWidthPx = Math.max(viewportWidth - 40, 220)
    const visibleFraction = 0.45
    const factor = 1 + Math.max(trickPlayCount - 1, 0) * visibleFraction
    const cardWidthPx = Math.min(72, Math.max(38, availableWidthPx / factor))
    const overlapOffsetPx = -(cardWidthPx * (1 - visibleFraction))

    return {
      cardWidth: `${cardWidthPx / 16}rem`,
      overlapOffset: `${overlapOffsetPx / 16}rem`,
      useCompactSizing: true,
    }
  }, [trickPlayCount, viewportWidth])
  const useScatterTrickLayout = true
  const scatterTrickPositionsByPlayerId = useMemo(() => {
    if (!useScatterTrickLayout || totalTrickPlayers === 0) {
      return new Map()
    }

    const basePlayerIds = orderedPlayers.length > 0
      ? orderedPlayers.map((player) => player.id)
      : ((game.playerOrder ?? game.players?.map((player) => player.id) ?? []))
    const leadPlayerIndex = basePlayerIds.indexOf(leadTrickPlayerId)
    const playerIds = leadPlayerIndex >= 0
      ? [
          ...basePlayerIds.slice(leadPlayerIndex),
          ...basePlayerIds.slice(0, leadPlayerIndex),
        ]
      : basePlayerIds
    const angleStep = (Math.PI * 2) / totalTrickPlayers
    const startAngle = -Math.PI / 2
    const radiusX = isMobileViewport
      ? totalTrickPlayers >= 7 ? 37 : 34
      : totalTrickPlayers >= 7 ? 40 : 36
    const radiusY = isMobileViewport
      ? totalTrickPlayers >= 7 ? 30 : 27
      : totalTrickPlayers >= 7 ? 32 : 28
    const nextPositions = new Map()

    playerIds.forEach((playerId, index) => {
      const angle = startAngle + index * angleStep
      const x = 50 + Math.cos(angle) * radiusX
      const baseY = 48 + Math.sin(angle) * radiusY
      const yAdjustment =
        totalTrickPlayers === 6
          ? index === 1 || index === 5
            ? -6
            : index === 2 || index === 4
              ? 6
              : 0
          : 0
      const y = baseY + yAdjustment

      nextPositions.set(playerId, {
        left: `${x}%`,
        top: `${y}%`,
      })
    })

    return nextPositions
  }, [
    game.playerOrder,
    game.players,
    isMobileViewport,
    leadTrickPlayerId,
    orderedPlayers,
    totalTrickPlayers,
    useScatterTrickLayout,
  ])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

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

  const openRemovePlayerConfirm = (player) => {
    if (!player) {
      return
    }

    setPendingRemovePlayer({
      id: player.id,
      name: player.name,
    })
  }

  const closeRemovePlayerConfirm = () => {
    setPendingRemovePlayer(null)
  }

  useEffect(() => {
    if (isGameOver && !bookWinnerMessage && !hasAutoOpenedGameOverScoreRef.current) {
      setIsScoreModalOpen(true)
      hasAutoOpenedGameOverScoreRef.current = true
    }

    if (!isGameOver) {
      hasAutoOpenedGameOverScoreRef.current = false
    }
  }, [bookWinnerMessage, isGameOver])

  const availableActions = (() => {
    switch (game.phase?.stage) {
      case 'Dealing':
        return isViewerActualTurn ? ['Deal Cards'] : []
      case 'Bidding':
        return isViewerActualTurn ? ['Submit Bid'] : []
      case 'Playing':
        return isViewerActualTurn ? ['Play Card'] : []
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
                ((action === 'Deal Cards' || action === 'Submit Bid') && isViewerActualTurn && !isDisabled) ||
                (action === 'Play Card' && isViewerActualTurn && selectedCard !== null && !isDisabled)
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
          <div
            className="floating-panel fixed right-4 z-50 w-[20rem] max-w-[calc(100vw-2rem)] rounded-2xl p-3"
            style={{
              right: `${reactionModalPosition.right}px`,
              bottom: `${reactionModalPosition.bottom}px`,
            }}
          >
            {reactionPhraseCategories.length > 0 ? (
              <div className="mb-3 grid grid-cols-3 gap-2">
                {reactionPhraseCategories.map((category) => {
                  const isActive = category.id === selectedReactionPhraseCategoryId

                  return (
                    <button
                      key={category.id}
                      type="button"
                      className={`min-h-10 rounded-2xl border px-2 py-1.5 text-center text-[0.65rem] font-semibold uppercase tracking-[0.12em] transition ${
                        isActive
                          ? 'border-amber-300/80 bg-amber-200/20 text-amber-50'
                          : 'border-white/15 bg-white/5 text-white/80 hover:border-white/30 hover:bg-white/10'
                      }`}
                      onClick={() => handleReactionCategorySelect(category.id)}
                      disabled={isSendingReaction || isReactionOnCooldown}
                    >
                      {category.label}
                    </button>
                  )
                })}
              </div>
            ) : null}
            {reactionPhraseOptions.length > 0 ? (
              <div className="mb-3 grid gap-2">
                {reactionPhraseOptions.map((phrase) => (
                  <button
                    key={phrase}
                    type="button"
                    className="rounded-2xl border border-white/12 bg-white/6 px-3 py-2 text-left text-sm text-white transition hover:border-white/25 hover:bg-white/10 disabled:opacity-50"
                    onClick={async () => {
                      try {
                        await onSendReaction?.({ phrase })
                        setIsReactionModalOpen(false)
                      } catch {
                        // Keep the picker open so the user can retry.
                      }
                    }}
                    disabled={isSendingReaction || isReactionOnCooldown}
                  >
                    {phrase}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="grid grid-cols-4 gap-2">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="flex h-11 items-center justify-center rounded-xl bg-transparent text-[1.8rem] transition hover:scale-110 disabled:opacity-50"
                  onClick={async () => {
                    try {
                      await onSendReaction?.({ emoji })
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
        {emojiReactionLayouts.map(({ reaction, style }) => (
          <div
            key={reaction.id}
            className="reaction-float"
            style={style}
          >
            <div className={`reaction-badge ${reaction.phrase ? 'reaction-badge-phrase' : ''}`}>
              {reaction.phrase ? (
                <>
                  <span className="reaction-speaker truncate">{getPlayerName(game, reaction.playerId)}</span>
                  <span className="reaction-text">{reaction.phrase}</span>
                </>
              ) : (
                <>
                  <span className="truncate">{getPlayerName(game, reaction.playerId)}</span>
                  <span className="text-2xl leading-none">{reaction.emoji ?? ''}</span>
                </>
              )}
            </div>
          </div>
        ))}
        {phraseReactionLayouts.map(({ reaction, style }) => (
          <div
            key={reaction.id}
            className="reaction-float-phrase"
            style={style}
          >
            <div className="reaction-badge reaction-badge-phrase">
              <span className="reaction-speaker truncate">{getPlayerName(game, reaction.playerId)}</span>
              <span className="reaction-text">{reaction.phrase ?? ''}</span>
            </div>
          </div>
        ))}
        {floatingCelebrations.map(({ id, message, style }) => (
          <div
            key={id}
            className="celebration-float"
            style={style}
          >
            <div className="celebration-badge">
              <span className="celebration-spark" aria-hidden="true">✦</span>
              <span>{message}</span>
              <span className="celebration-spark" aria-hidden="true">✦</span>
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
              nowMs={nowMs}
              isGameOver={isGameOver}
              isOwner={isOwner}
              viewerPlayerId={viewerPlayerId}
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
            {game.phase?.stage === 'Bidding' ? (
              <section className="panel-surface mb-3 flex min-h-0 flex-1 flex-col rounded-2xl border px-3 py-3 sm:px-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-accent-strong text-sm font-semibold uppercase tracking-[0.18em]">Bids</h2>
                  <p className="text-accent text-xs">
                    {bids.length}/{biddingPlayers.length} in
                  </p>
                </div>
                <ul className="score-scroll mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-auto pr-1">
                  {biddingPlayers.map((player) => {
                    const bidEntry = bidsByPlayerId.get(player.id)
                    const isCurrentBidder = displayedTurnPlayerId === player.id
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
            {game.phase?.stage === 'Bidding' ? null : (
              <div ref={trickSurfaceRef} className="relative flex min-h-[152px] flex-1 overflow-visible">
                {selectedTrickCardIndex !== null && !useScatterTrickLayout ? (
                  <div className="pointer-events-none absolute inset-0 z-20">
                    {returningTrickLabel ? (
                      <p
                        key={returningTrickLabel.key}
                        className="trick-card-player-label absolute truncate text-left"
                        style={returningTrickLabel.style}
                      >
                        {returningTrickLabel.text}
                      </p>
                    ) : null}
                    {displayedTrickPlays.map((play, index) => {
                      const labelStyle = passiveTrickLabelStyles[index]
                      if (!labelStyle || selectedTrickCardIndex === index) {
                        return null
                      }

                      return (
                        <p
                          key={`passive-trick-label-${play.playerId}-${index}`}
                          className="trick-card-player-label absolute truncate text-left"
                          style={labelStyle}
                        >
                          {getPassiveTrickPlayerLabel(
                            getPlayerName(game, play.playerId),
                            index,
                            displayedTrickPlays.length,
                          )}
                        </p>
                      )
                    })}
                  </div>
                ) : null}
                <ul
                  className={
                    useScatterTrickLayout
                      ? 'relative min-h-[220px] flex-1 overflow-visible pt-8'
                      : 'flex min-h-[152px] flex-1 items-center justify-center gap-4 overflow-x-auto pt-12 -translate-y-2'
                  }
                >
                  {displayedTrickPlays.length > 0 ? (
                    displayedTrickPlays.map((play, index) => (
                      <li
                        key={`${play.playerId}-${index}`}
                        className={
                          useScatterTrickLayout
                            ? 'absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-sm'
                            : 'flex w-fit shrink-0 flex-col items-center text-sm'
                        }
                        style={
                          useScatterTrickLayout
                            ? {
                                ...(scatterTrickPositionsByPlayerId.get(play.playerId) ?? {
                                  left: '50%',
                                  top: '48%',
                                }),
                                zIndex:
                                  selectedTrickCardIndex === index
                                    ? trickPlayCount + 20
                                    : play.playerId === leadTrickPlayerId
                                      ? trickPlayCount + 10
                                      : index + 1,
                              }
                            : {
                                marginLeft: index === 0 ? '0' : trickLayout.overlapOffset,
                                zIndex: index + 1,
                              }
                        }
                      >
                        <button
                          ref={(node) => {
                            trickCardButtonRefs.current[index] = node
                          }}
                          type="button"
                          className={`relative shrink-0 overflow-visible rounded-lg bg-transparent p-0 transition-transform duration-150 ${
                            selectedTrickCardIndex === index
                              ? useScatterTrickLayout
                                ? 'z-20 scale-110'
                                : '-translate-y-4'
                              : 'translate-y-0'
                          }`}
                          onClick={() => handleSelectTrickCard(index)}
                          aria-label={getPlayerName(game, play.playerId)}
                        >
                          {selectedTrickCardIndex === null && !useScatterTrickLayout ? (
                            <p className="trick-card-player-label pointer-events-none absolute bottom-full left-2 mb-1.5 w-12 truncate text-left sm:left-1 sm:w-24">
                              {getPassiveTrickPlayerLabel(
                                getPlayerName(game, play.playerId),
                                index,
                                displayedTrickPlays.length,
                              )}
                            </p>
                          ) : null}
                          <div
                            className={`aspect-[2.5/3.5] ${trickLayout.useCompactSizing ? '' : 'w-24 sm:w-28'}`}
                            style={{
                              ...(trickLayout.useCompactSizing ? { width: trickLayout.cardWidth } : {}),
                              ...(selectedTrickCardIndex === index
                                ? { filter: 'drop-shadow(0 0 16px rgba(255,255,255,0.55))' }
                                : {}),
                            }}
                          >
                            <CardAsset
                              card={play.card}
                              showCenterSymbol={!trickLayout.useCompactSizing}
                              centerSymbolClassName="text-[104%] leading-none sm:text-[132%]"
                              jokerTextClassName="text-[70%] font-bold tracking-[0.06em]"
                            />
                          </div>
                        </button>
                        {useScatterTrickLayout ? (
                          <div className="pointer-events-none mt-1 flex flex-col items-center">
                            <p
                              className={`rounded-full px-2 py-0.5 text-center text-[0.62rem] transition ${
                                selectedTrickCardIndex === index
                                  ? 'border border-white/30 bg-slate-950/95 text-white shadow-[0_4px_14px_rgba(15,23,42,0.45)]'
                                  : 'border border-white/10 bg-black/35 text-white/70'
                              }`}
                            >
                              <span
                                className={
                                  selectedTrickCardIndex === index
                                    ? 'block max-w-[8.5rem] whitespace-nowrap text-sm font-medium'
                                    : 'block max-w-[4.75rem] truncate'
                                }
                              >
                                {selectedTrickCardIndex === index
                                  ? getPlayerName(game, play.playerId)
                                  : getPassiveTrickPlayerLabel(
                                      getPlayerName(game, play.playerId),
                                      index,
                                      displayedTrickPlays.length,
                                    )}
                              </span>
                            </p>
                            {play.playerId === leadTrickPlayerId ? (
                              <p className="mt-0.5 text-[0.65rem] font-medium tracking-[0.18em] text-dim">
                                LEAD
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    ))
                  ) : (
                    <li className="self-center text-sm text-dim">
                      {isGameOver ? '' : 'No cards played in this trick yet.'}
                    </li>
                  )}
                </ul>
              </div>
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
        <div className="mt-3 flex min-h-7 items-center justify-center">
          {bookWinnerMessage ? (
            <p className="status-info px-6 py-2 text-center text-xl font-semibold">{bookWinnerMessage}</p>
          ) : isGameOver || isTrickWinnerRevealVisible ? null : isViewerTurnVisible ? (
            <p className="status-turn px-6 py-2 text-xl font-semibold">
              {viewerTurnMessage}
            </p>
          ) : displayedTurnPlayerId ? (
            <p className="text-sm text-dim">
              {waitingAction
                ? `Waiting on ${getPlayerName(game, displayedTurnPlayerId)}${isOwner && isAwayTurnPlayer ? ' (Away)' : ''} to ${waitingAction}`
                : `Waiting on ${getPlayerName(game, displayedTurnPlayerId)}${isOwner && isAwayTurnPlayer ? ' (Away)' : ''}...`}
            </p>
          ) : null}
        </div>
        <article
          className={`mt-3 shrink-0 overflow-hidden rounded-3xl border p-1 sm:overflow-x-auto ${
            isViewerTurnVisible
              ? 'hand-active hand-active-turn'
              : canSelectCards
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
              nowMs={nowMs}
              currentRoundConfig={currentRoundConfig}
              isGameOver={isGameOver}
              isOwner={isOwner}
              viewerPlayerId={viewerPlayerId}
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
            {(() => {
              const selectedPlayerPresence = getPlayerPresence(selectedScorePlayer)
              const isSelectedPlayerAway = selectedScorePlayer.type === 'human' && selectedPlayerPresence.away
              const isSelectedPlayerTurn = selectedScorePlayer.id === actualTurnPlayerId
              const selectedPlayerIdleSince = Math.max(
                selectedPlayerPresence.lastSeenAt ?? 0,
                game.phase?.turnStartedAt ?? 0,
              )
              const isSelectedPlayerIdleOnTurn =
                selectedScorePlayer.type === 'human' &&
                !selectedPlayerPresence.away &&
                isSelectedPlayerTurn &&
                selectedPlayerIdleSince > 0 &&
                nowMs - selectedPlayerIdleSince >= OWNER_IDLE_TURN_TIMEOUT_MS
              const canCoverSelectedPlayerTurn =
                selectedScorePlayer.id !== ownerPlayerId &&
                ((isSelectedPlayerAway && isSelectedPlayerTurn) || isSelectedPlayerIdleOnTurn)

              return (
                <>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Manage Player</h2>
            </div>
            <p className="mt-2 text-sm text-muted">
              {selectedScorePlayer.name}
              {isSelectedPlayerAway ? ' • Away' : ''}
            </p>
            {isSelectedPlayerIdleOnTurn ? (
              <p className="status-info mt-4 text-sm">
                This player has been idle on their turn for at least 60 seconds.
              </p>
            ) : null}
            {isSelectedPlayerAway && isSelectedPlayerTurn ? (
              <p className="status-info mt-4 text-sm">
                This player is away and it is currently their turn.
              </p>
            ) : null}
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
              {canCoverSelectedPlayerTurn ? (
                <button
                  type="button"
                  className="btn-primary px-4 py-2 disabled:opacity-50"
                  onClick={async () => {
                    if (!selectedScorePlayer) {
                      return
                    }

                    onSetGameError('')
                    const didCover = await onCoverAwayPlayerTurn?.(selectedScorePlayer.id)
                    if (didCover) {
                      closeScorePlayerModal()
                    }
                  }}
                  disabled={
                    pendingPlayerActionId === selectedScorePlayer.id ||
                    isRenamingPlayer
                  }
                >
                  {pendingPlayerActionId === selectedScorePlayer.id ? 'Playing...' : 'Let AI Play Turn'}
                </button>
              ) : null}
              <div className="flex justify-between gap-3">
                <button
                  type="button"
                  className="btn-danger btn-danger-soft px-4 py-2 disabled:opacity-50"
                  onClick={async () => {
                    if (!selectedScorePlayer) {
                      return
                    }

                    onSetGameError('')
                    openRemovePlayerConfirm(selectedScorePlayer)
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
                </>
              )
            })()}
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
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 w-full sm:w-auto">
                <button
                  type="button"
                  className="block w-full min-w-0 truncate text-left text-xl font-semibold text-white transition hover:[color:var(--accent-green-soft)] sm:max-w-[14rem]"
                  onClick={() => {
                    setIsEditingPlayerName(true)
                    setEditedPlayerName(currentPlayerName)
                  }}
                  title={currentPlayerName}
                >
                  {`👤 ${shortenedMenuPlayerName}`}
                </button>
              </div>
              <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
                <button
                  type="button"
                  className="badge-subtle inline-flex w-full items-center justify-center gap-2 truncate rounded-full border px-3 py-1 text-sm font-medium text-muted transition hover:border-white/20 hover:text-white sm:w-auto"
                  onClick={() => setIsShareModalOpen(true)}
                  aria-label={`Share game ${game.id}`}
                  title="Share game"
                >
                  <span className="text-accent font-medium [text-shadow:0_0_12px_rgba(158,211,180,0.35)]">
                    {game.id}
                  </span>
                  <ShareIcon className="h-5 w-5" />
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
                    setIsLeaveConfirmModalOpen(true)
                  }}
                  disabled={isLeavingGame}
                >
                  {isLeavingGame ? "Leaving..." : "Leave Game"}
                </button>
              )}
              <div className="mt-1 w-[90%] border-t border-[color:var(--border-color)] pt-3" />
            </div>
            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[color:var(--accent-blue)] bg-[rgba(47,111,219,0.12)] p-0 text-[color:var(--accent-blue-soft)] transition hover:bg-[rgba(47,111,219,0.2)]"
                  aria-label="Help"
                  title="Help"
                  onClick={() => {
                    setIsMenuModalOpen(false)
                    onOpenHelp?.()
                  }}
                >
                  <HelpIcon className="h-[1.5625rem] w-[1.5625rem]" />
                </button>
                {canInstallApp ? (
                  <button
                    type="button"
                    className="btn-secondary btn-install inline-flex h-10 w-10 items-center justify-center p-0"
                    aria-label="Install App"
                    title="Install App"
                    onClick={async () => {
                      setIsMenuModalOpen(false)
                      await onInstallApp?.()
                    }}
                  >
                    <DownloadIcon className="h-[1.5625rem] w-[1.5625rem]" />
                  </button>
                ) : null}
              </div>
              <div className="flex justify-end">
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
        </div>
      )}
      {isShareModalOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-4"
          onClick={() => setIsShareModalOpen(false)}
        >
          <div
            className="dialog-surface max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-6 text-left"
            onClick={(event) => event.stopPropagation()}
          >
            <div>
              <div>
                <h2 className="text-xl font-semibold text-white">Share Game</h2>
              </div>
              <div className="divider mt-3 border-t" />
            </div>
            <div className="mt-5 flex flex-col gap-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-dim">Game ID</p>
                <div className="mt-2 rounded-2xl border border-white/10 bg-black/15 px-4 py-3">
                  <p className="text-center text-lg font-semibold text-white">{game.id}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-dim">Game URL</p>
                <button
                  type="button"
                  className="input-surface mt-2 flex w-full cursor-pointer items-center gap-2 truncate whitespace-nowrap text-left text-sm transition hover:border-white/20"
                  onClick={onCopyShareLink}
                  aria-label={isShareLinkCopied ? 'Share link copied' : 'Copy share link'}
                  title={isShareLinkCopied ? 'Copied' : 'Copy link'}
                >
                  <LinkIcon className="h-4 w-4 shrink-0 text-dim" />
                  <span className="min-w-0 truncate">
                    {isShareLinkCopied ? 'Copied!' : shareLink}
                  </span>
                </button>
              </div>
              <div className="flex w-fit self-center flex-col items-center rounded-xl border border-white/10 bg-white/95 p-2">
                {shareQrCodeDataUrl ? (
                  <img
                    src={shareQrCodeDataUrl}
                    alt={`QR code for joining game ${game.id}`}
                    className="h-48 w-48 max-w-full rounded-md"
                  />
                ) : (
                  <div className="flex h-48 w-48 max-w-full items-center justify-center rounded-md bg-slate-100 text-sm text-slate-500">
                    Generating QR code...
                  </div>
                )}
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="btn-secondary px-3 py-1.5"
                  onClick={() => setIsShareModalOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
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
      {isLeaveConfirmModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-4"
          onClick={() => setIsLeaveConfirmModalOpen(false)}
        >
          <div
            className="dialog-surface max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-6 text-left"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-xl font-semibold text-white">Leave Game?</h2>
            <p className="mt-3 text-sm text-muted">
              You will leave this game and return to the home screen.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="btn-secondary px-4 py-2"
                onClick={() => setIsLeaveConfirmModalOpen(false)}
                disabled={isLeavingGame}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger btn-danger-soft px-4 py-2 disabled:opacity-50"
                onClick={() => {
                  setIsLeaveConfirmModalOpen(false)
                  onLeaveGame?.()
                }}
                disabled={isLeavingGame}
              >
                {isLeavingGame ? 'Leaving...' : 'Leave Game'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {pendingRemovePlayer ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-4"
          onClick={closeRemovePlayerConfirm}
        >
          <div
            className="dialog-surface max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-6 text-left"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-xl font-semibold text-white">Remove Player?</h2>
            <p className="mt-3 text-sm text-muted">
              {`Remove ${pendingRemovePlayer.name} from this game?`}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="btn-secondary px-4 py-2"
                onClick={closeRemovePlayerConfirm}
                disabled={pendingPlayerActionId === pendingRemovePlayer.id}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger btn-danger-soft px-4 py-2 disabled:opacity-50"
                onClick={async () => {
                  const playerId = pendingRemovePlayer.id
                  const didRemove = await onRemovePlayer?.(playerId)
                  if (didRemove) {
                    if (selectedScorePlayerId === playerId) {
                      closeScorePlayerModal()
                    }
                    closeRemovePlayerConfirm()
                  }
                }}
                disabled={pendingPlayerActionId === pendingRemovePlayer.id}
              >
                {pendingPlayerActionId === pendingRemovePlayer.id ? 'Removing...' : 'Remove Player'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
    </div>
  )
}


export { DownloadIcon, GameTablePage, HelpIcon, LinkIcon, ShareIcon }
