import { useEffect, useMemo, useRef, useState } from 'react'
import { CardAsset, CardBack } from './Cards'
import {
  getCompletedRoundCount,
  getMaxCardsForSeatCount,
  getPlayerName,
  getRoundDirectionArrow,
  sortHandCards,
  getViewerHand,
  hashString,
} from '../utils/gameUi'
import { useGameTablePlayState } from '../hooks/useGameTablePlayState'
import { useGameTableModalState } from '../hooks/useGameTableModalState'
import { useGameTableState } from '../hooks/useGameTableState'
import { getPlayerPresence } from '../utils/playerPresence'
import {
  GameTableActionBar,
  GameTableBiddingPanel,
  GameTableHand,
  GameTableReactionOverlay,
  GameTableScorePanel,
  GameTableStatusBanner,
} from './GameTablePageSections'
import { GameTableModals } from './GameTablePageModals'

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
  const [nowMs, setNowMs] = useState(() => Date.now())
  const mobileActionBarRef = useRef(null)
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
  const {
    closeRemovePlayerConfirm,
    closeScorePlayerModal,
    editedPlayerName,
    isEditingPlayerName,
    isHistoryModalOpen,
    isLeaveConfirmModalOpen,
    isResetConfirmModalOpen,
    isScoreModalOpen,
    openRemovePlayerConfirm,
    pendingRemovePlayer,
    scorePlayerNameDraft,
    selectedScorePlayer,
    selectedScorePlayerId,
    setEditedPlayerName,
    setIsEditingPlayerName,
    setIsHistoryModalOpen,
    setIsLeaveConfirmModalOpen,
    setIsResetConfirmModalOpen,
    setIsScoreModalOpen,
    setScorePlayerNameDraft,
    setSelectedScorePlayerId,
    shortenedMenuPlayerName,
  } = useGameTableModalState({
    bookWinnerMessage,
    currentPlayerName,
    gamePlayers: game.players,
    isGameOver,
    isMenuModalOpen,
    orderedPlayers,
  })
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

  return (
    <div className="contents">
      <GameTableReactionOverlay
        emojiReactionLayouts={emojiReactionLayouts}
        phraseReactionLayouts={phraseReactionLayouts}
        floatingCelebrations={floatingCelebrations}
        game={game}
      />
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
          <GameTableScorePanel
            bids={bids}
            booksByPlayerId={booksByPlayerId}
            currentRoundConfig={currentRoundConfig}
            currentRoundIndex={currentRoundIndex}
            game={game}
            isGameOver={isGameOver}
            isOwner={isOwner}
            nowMs={nowMs}
            onOpenHistory={() => setIsHistoryModalOpen(true)}
            onSelectPlayer={(player) => setSelectedScorePlayerId(player.id)}
            viewerPlayerId={viewerPlayerId}
          />

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
              <GameTableBiddingPanel
                bids={bids}
                bidsByPlayerId={bidsByPlayerId}
                biddingPlayers={biddingPlayers}
                currentRoundIndex={currentRoundIndex}
                displayedTurnPlayerId={displayedTurnPlayerId}
                game={game}
              />
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
        <GameTableStatusBanner
          bookWinnerMessage={bookWinnerMessage}
          displayedTurnPlayerId={displayedTurnPlayerId}
          game={game}
          isAwayTurnPlayer={isAwayTurnPlayer}
          isGameOver={isGameOver}
          isOwner={isOwner}
          isTrickWinnerRevealVisible={isTrickWinnerRevealVisible}
          isViewerTurnVisible={isViewerTurnVisible}
          viewerTurnMessage={viewerTurnMessage}
          waitingAction={waitingAction}
        />
        <GameTableHand
          canSelectCards={canSelectCards}
          game={game}
          handLayout={handLayout}
          isGameOver={isGameOver}
          isPlayingCard={isPlayingCard}
          isViewerTurnVisible={isViewerTurnVisible}
          onSetGameError={onSetGameError}
          selectedCardIndex={selectedCardIndex}
          setSelectedCardIndex={setSelectedCardIndex}
          viewerHand={viewerHand}
        >
          <div className="hidden md:block">
            <GameTableActionBar
              availableActions={availableActions}
              canSortCards={canSortCards}
              handleReactionCategorySelect={handleReactionCategorySelect}
              isActionEnabled={isActionEnabled}
              isDealingCards={isDealingCards}
              isMobileBar={false}
              isMobileViewport={isMobileViewport}
              isPlayingCard={isPlayingCard}
              isReactionModalOpen={isReactionModalOpen}
              isReactionOnCooldown={isReactionOnCooldown}
              isSendingReaction={isSendingReaction}
              isSortingCards={isSortingCards}
              isStartingOver={isStartingOver}
              isSubmittingBid={isSubmittingBid}
              isViewerActualTurn={isViewerActualTurn}
              onDealCards={onDealCards}
              onOpenJoinGame={onOpenJoinGame}
              onOpenNewGame={onOpenNewGame}
              onPlayCard={onPlayCard}
              onSendReaction={onSendReaction}
              onSortCards={onSortCards}
              onStartOver={onStartOver}
              onSubmitBid={onSubmitBid}
              reactionModalPosition={reactionModalPosition}
              reactionPhraseCategories={reactionPhraseCategories}
              reactionPhraseOptions={reactionPhraseOptions}
              reactionPickerRef={reactionPickerRef}
              selectedCard={selectedCard}
              selectedReactionPhraseCategoryId={selectedReactionPhraseCategoryId}
              setIsMenuModalOpen={setIsMenuModalOpen}
              setIsReactionModalOpen={setIsReactionModalOpen}
              setIsScoreModalOpen={setIsScoreModalOpen}
              sortMode={sortMode}
            />
          </div>
        </GameTableHand>
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
        <GameTableActionBar
          availableActions={availableActions}
          canSortCards={canSortCards}
          handleReactionCategorySelect={handleReactionCategorySelect}
          isActionEnabled={isActionEnabled}
          isDealingCards={isDealingCards}
          isMobileBar
          isMobileViewport={isMobileViewport}
          isPlayingCard={isPlayingCard}
          isReactionModalOpen={isReactionModalOpen}
          isReactionOnCooldown={isReactionOnCooldown}
          isSendingReaction={isSendingReaction}
          isSortingCards={isSortingCards}
          isStartingOver={isStartingOver}
          isSubmittingBid={isSubmittingBid}
          isViewerActualTurn={isViewerActualTurn}
          onDealCards={onDealCards}
          onOpenJoinGame={onOpenJoinGame}
          onOpenNewGame={onOpenNewGame}
          onPlayCard={onPlayCard}
          onSendReaction={onSendReaction}
          onSortCards={onSortCards}
          onStartOver={onStartOver}
          onSubmitBid={onSubmitBid}
          reactionModalPosition={reactionModalPosition}
          reactionPhraseCategories={reactionPhraseCategories}
          reactionPhraseOptions={reactionPhraseOptions}
          reactionPickerRef={reactionPickerRef}
          selectedCard={selectedCard}
          selectedReactionPhraseCategoryId={selectedReactionPhraseCategoryId}
          setIsMenuModalOpen={setIsMenuModalOpen}
          setIsReactionModalOpen={setIsReactionModalOpen}
          setIsScoreModalOpen={setIsScoreModalOpen}
          sortMode={sortMode}
        />
      </div>
      <GameTableModals
        DownloadIcon={DownloadIcon}
        HelpIcon={HelpIcon}
        LinkIcon={LinkIcon}
        ShareIcon={ShareIcon}
        actualTurnPlayerId={actualTurnPlayerId}
        bids={bids}
        booksByPlayerId={booksByPlayerId}
        canInstallApp={canInstallApp}
        closeRemovePlayerConfirm={closeRemovePlayerConfirm}
        closeScorePlayerModal={closeScorePlayerModal}
        currentPlayerName={currentPlayerName}
        currentRoundConfig={currentRoundConfig}
        currentRoundIndex={currentRoundIndex}
        editedPlayerName={editedPlayerName}
        game={game}
        isEditingPlayerName={isEditingPlayerName}
        isGameOver={isGameOver}
        isHistoryModalOpen={isHistoryModalOpen}
        isJoinModalOpen={isJoinModalOpen}
        isLeavingGame={isLeavingGame}
        isLeaveConfirmModalOpen={isLeaveConfirmModalOpen}
        isMenuModalOpen={isMenuModalOpen}
        isOwner={isOwner}
        isRenamingPlayer={isRenamingPlayer}
        isResetConfirmModalOpen={isResetConfirmModalOpen}
        isScoreModalOpen={isScoreModalOpen}
        isShareLinkCopied={isShareLinkCopied}
        isShareModalOpen={isShareModalOpen}
        nowMs={nowMs}
        onCopyShareLink={onCopyShareLink}
        onCoverAwayPlayerTurn={onCoverAwayPlayerTurn}
        onInstallApp={onInstallApp}
        onLeaveGame={onLeaveGame}
        onOpenHelp={onOpenHelp}
        onOpenJoinGame={onOpenJoinGame}
        onOpenNewGame={onOpenNewGame}
        onRemovePlayer={onRemovePlayer}
        onRenamePlayer={onRenamePlayer}
        onSetGameError={onSetGameError}
        onStartOver={onStartOver}
        openRemovePlayerConfirm={openRemovePlayerConfirm}
        ownerPlayerId={ownerPlayerId}
        pendingPlayerActionId={pendingPlayerActionId}
        pendingRemovePlayer={pendingRemovePlayer}
        scorePlayerNameDraft={scorePlayerNameDraft}
        selectedScorePlayer={selectedScorePlayer}
        selectedScorePlayerId={selectedScorePlayerId}
        setEditedPlayerName={setEditedPlayerName}
        setIsEditingPlayerName={setIsEditingPlayerName}
        setIsHistoryModalOpen={setIsHistoryModalOpen}
        setIsLeaveConfirmModalOpen={setIsLeaveConfirmModalOpen}
        setIsMenuModalOpen={setIsMenuModalOpen}
        setIsResetConfirmModalOpen={setIsResetConfirmModalOpen}
        setIsScoreModalOpen={setIsScoreModalOpen}
        setIsShareModalOpen={setIsShareModalOpen}
        setScorePlayerNameDraft={setScorePlayerNameDraft}
        setSelectedScorePlayerId={setSelectedScorePlayerId}
        shareLink={shareLink}
        shareQrCodeDataUrl={shareQrCodeDataUrl}
        shortenedMenuPlayerName={shortenedMenuPlayerName}
        viewerPlayerId={viewerPlayerId}
      />
    </main>
    </div>
  )
}


export { DownloadIcon, GameTablePage, HelpIcon, LinkIcon, ShareIcon }
