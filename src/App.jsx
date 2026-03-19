import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import {
  checkState,
  getGameState,
  returnFromAway,
  setActiveGameSession,
  subscribeToGameEvents,
} from './api/lambdaClient'
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
import { CardAsset, CardBack } from './components/Cards'
import { useGameActions } from './hooks/useGameActions'
import { useLobbyDerivedState } from './hooks/useLobbyDerivedState'
import { RoundStatusLabel, ScoreHistory, ScoreSheet, ScoreSummary } from './components/Scoreboard'
import { CreateGameModal, JoinGameModal } from './components/SessionModals'
import {
  REACTION_EMOJIS,
  TRICK_COMPLETE_DELAY_MS,
  buildRoundSummary,
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
  toUserFacingActionError,
} from './utils/gameUi'
import { getRandomReactionPhrases, getReactionPhraseCategories } from './utils/reactionPhrases'
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
import { getPlayerPresence } from './utils/playerPresence'
import { usePwaInstall } from './utils/pwa'
import {
  applyResultToSessionRole,
  buildOwnerSession,
  buildPlayerSession,
  clearActiveSessionState as clearSessionState,
  clearTimeoutRefs,
  getActiveSessionContext,
  getActiveSession,
  getActiveSessionRole,
  getRestoredPlayerName,
  setSessionForRole,
} from './utils/sessionState'

const AI_DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
]

const OWNER_IDLE_TURN_TIMEOUT_MS = 60_000
const MAX_SEATS = 8

const isStagingBuild = import.meta.env.VITE_APP_ENV === 'staging'
const buildTimestampLabel = typeof __BUILD_TIMESTAMP__ === 'string' ? __BUILD_TIMESTAMP__ : ''

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
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 1024 : window.innerWidth,
  )
  const [mobileActionBarHeight, setMobileActionBarHeight] = useState(0)
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [shareQrCodeDataUrl, setShareQrCodeDataUrl] = useState('')

  useEffect(() => {
    if (menuCloseRequestKey > 0) {
      setIsMenuModalOpen(false)
    }
  }, [menuCloseRequestKey])

  useEffect(() => {
    let isCancelled = false

    if (!isShareModalOpen || !shareLink) {
      setShareQrCodeDataUrl('')
      return undefined
    }

    QRCode.toDataURL(shareLink, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
      color: {
        dark: '#0f172a',
        light: '#f8fafc',
      },
    })
      .then((url) => {
        if (!isCancelled) {
          setShareQrCodeDataUrl(url)
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setShareQrCodeDataUrl('')
          onSetGameError?.('Unable to generate QR code.')
        }
      })

    return () => {
      isCancelled = true
    }
  }, [isShareModalOpen, onSetGameError, shareLink])

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
  const [selectedCardIndex, setSelectedCardIndex] = useState(null)
  const [selectedTrickCardIndex, setSelectedTrickCardIndex] = useState(null)
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [isResetConfirmModalOpen, setIsResetConfirmModalOpen] = useState(false)
  const [isLeaveConfirmModalOpen, setIsLeaveConfirmModalOpen] = useState(false)
  const [isReactionModalOpen, setIsReactionModalOpen] = useState(false)
  const [selectedReactionPhraseCategoryId, setSelectedReactionPhraseCategoryId] = useState('')
  const [reactionPhraseOptions, setReactionPhraseOptions] = useState([])
  const [reactionModalPosition, setReactionModalPosition] = useState({ right: 16, bottom: 16 })
  const [isEditingPlayerName, setIsEditingPlayerName] = useState(false)
  const [selectedScorePlayerId, setSelectedScorePlayerId] = useState('')
  const [pendingRemovePlayer, setPendingRemovePlayer] = useState(null)
  const [scorePlayerNameDraft, setScorePlayerNameDraft] = useState('')
  const [editedPlayerName, setEditedPlayerName] = useState('')
  const [bookWinnerMessage, setBookWinnerMessage] = useState('')
  const [revealedCompletedTrick, setRevealedCompletedTrick] = useState(null)
  const [displayedTurnPlayerId, setDisplayedTurnPlayerId] = useState(actualTurnPlayerId)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [selectedTrickLabelStyle, setSelectedTrickLabelStyle] = useState(null)
  const [passiveTrickLabelStyles, setPassiveTrickLabelStyles] = useState([])
  const [returningTrickLabel, setReturningTrickLabel] = useState(null)
  const [floatingCelebrations, setFloatingCelebrations] = useState([])
  const previousCompletedTrickCountRef = useRef(0)
  const floatingCelebrationTimeoutsRef = useRef([])
  const bookWinnerTimeoutRef = useRef(null)
  const selectedTrickCardTimeoutRef = useRef(null)
  const returningTrickLabelTimeoutRef = useRef(null)
  const returningTrickLabelFrameRef = useRef(null)
  const mobileActionBarRef = useRef(null)
  const reactionPickerRef = useRef(null)
  const hasAutoOpenedGameOverScoreRef = useRef(false)
  const gameOverScoreTimeoutRef = useRef(null)
  const trickSurfaceRef = useRef(null)
  const trickCardButtonRefs = useRef([])
  const selectedTrickLabelRef = useRef(null)
  const previousTrickIndexRef = useRef(game?.phase?.trickIndex)
  const previousTrumpBrokenRef = useRef(
    game?.phase && 'cards' in game.phase ? Boolean(game.phase.cards.trumpBroken) : null,
  )
  const shouldClearSelectedTrickCardAfterRevealRef = useRef(false)
  const isHoldingTurnPlayerRef = useRef(false)
  const latestActualTurnPlayerIdRef = useRef(actualTurnPlayerId)

  latestActualTurnPlayerIdRef.current = actualTurnPlayerId

  const isViewerActualTurn = Boolean(viewerPlayerId && actualTurnPlayerId && viewerPlayerId === actualTurnPlayerId)
  const isViewerDisplayedTurn = Boolean(
    viewerPlayerId && displayedTurnPlayerId && viewerPlayerId === displayedTurnPlayerId,
  )
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
  const isTrickWinnerRevealVisible = Boolean(bookWinnerMessage || revealedCompletedTrick)
  const isViewerTurnVisible = isViewerDisplayedTurn && !isTrickWinnerRevealVisible
  const canSelectCards = game.phase?.stage === 'Playing' && isViewerActualTurn && !isTrickWinnerRevealVisible
  const displayedTrick = revealedCompletedTrick ?? currentTrick
  const displayedTrickPlays = displayedTrick?.plays ?? []
  const trickPlayCount = displayedTrickPlays.length
  const totalTrickPlayers = orderedPlayers.length > 0 ? orderedPlayers.length : (game.playerOrder?.length ?? game.players?.length ?? 0)
  const leadTrickPlayerId = displayedTrick?.leadPlayerId ?? displayedTrickPlays[0]?.playerId ?? ''
  const winningDisplayedTrickCardIndex =
    revealedCompletedTrick?.winnerPlayerId
      ? revealedCompletedTrick.plays.findIndex((play) => play.playerId === revealedCompletedTrick.winnerPlayerId)
      : null
  const selectedCard =
    selectedCardIndex !== null && viewerHand?.cards?.[selectedCardIndex]
      ? viewerHand.cards[selectedCardIndex]
      : null
  const selectedTrickPlay =
    selectedTrickCardIndex !== null && displayedTrickPlays?.[selectedTrickCardIndex]
      ? displayedTrickPlays[selectedTrickCardIndex]
      : null
  const handCardCount = viewerHand?.cards?.length ?? 0
  const isMobileViewport = viewportWidth < 640
  const currentPlayerName = getPlayerName(game, viewerPlayerId)
  const selectedTrickPlayerName = selectedTrickPlay ? getPlayerName(game, selectedTrickPlay.playerId) : ''
  const selectedScorePlayer =
    orderedPlayers.find((player) => player.id === selectedScorePlayerId) ??
    game.players?.find((player) => player.id === selectedScorePlayerId) ??
    null
  const activeReactions = game?.reactions ?? []
  const trickPhraseSeed =
    typeof game?.phase?.trickIndex === 'number'
      ? game.phase.trickIndex
      : -1
  const reactionPhraseCategories = useMemo(
    () => getReactionPhraseCategories(),
    [],
  )
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

  useEffect(() => {
    if (!isReactionModalOpen) {
      return
    }

    const hasActiveCategory = reactionPhraseCategories.some((category) => category.id === selectedReactionPhraseCategoryId)
    if (hasActiveCategory && reactionPhraseOptions.length > 0) {
      return
    }

    const activeCategoryId = hasActiveCategory
      ? selectedReactionPhraseCategoryId
      : (reactionPhraseCategories[0]?.id ?? '')
    const nextOptions = getRandomReactionPhrases(activeCategoryId, 3, hashString(`${activeCategoryId}:${trickPhraseSeed}`))

    if (selectedReactionPhraseCategoryId !== activeCategoryId) {
      setSelectedReactionPhraseCategoryId(activeCategoryId)
    }

    setReactionPhraseOptions((current) => {
      if (
        current.length === nextOptions.length &&
        current.every((phrase, index) => phrase === nextOptions[index])
      ) {
        return current
      }

      return nextOptions
    })
  }, [isReactionModalOpen, reactionPhraseCategories, selectedReactionPhraseCategoryId, reactionPhraseOptions.length, trickPhraseSeed])

  useEffect(() => {
    if (!isReactionModalOpen || typeof window === 'undefined') {
      return
    }

    const updateReactionModalPosition = () => {
      const pickerBounds = reactionPickerRef.current?.getBoundingClientRect()
      if (!pickerBounds) {
        return
      }

      const nextPosition = {
        right: Math.max(16, window.innerWidth - pickerBounds.right),
        bottom: Math.max(16, window.innerHeight - pickerBounds.top + 12),
      }

      setReactionModalPosition((current) =>
        current.right === nextPosition.right && current.bottom === nextPosition.bottom
          ? current
          : nextPosition,
      )
    }

    updateReactionModalPosition()
    window.addEventListener('resize', updateReactionModalPosition)

    return () => {
      window.removeEventListener('resize', updateReactionModalPosition)
    }
  }, [isReactionModalOpen, isMobileViewport])

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
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => () => {
    floatingCelebrationTimeoutsRef.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId)
    })
    floatingCelebrationTimeoutsRef.current = []
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
    setDisplayedTurnPlayerId(actualTurnPlayerId)
    isHoldingTurnPlayerRef.current = false
  }, [actualTurnPlayerId, game?.id])

  useEffect(() => {
    if (isHoldingTurnPlayerRef.current || bookWinnerMessage) {
      return
    }

    setDisplayedTurnPlayerId(actualTurnPlayerId)
  }, [actualTurnPlayerId, bookWinnerMessage])

  useEffect(() => {
    setSelectedCardIndex(null)
  }, [displayedTurnPlayerId, game.phase?.stage, game.phase?.trickIndex])

  useEffect(() => {
    if (winningDisplayedTrickCardIndex !== null && winningDisplayedTrickCardIndex >= 0) {
      if (selectedTrickCardIndex !== winningDisplayedTrickCardIndex) {
        setSelectedTrickCardIndex(winningDisplayedTrickCardIndex)
      }
      return
    }

    if (selectedTrickCardIndex !== null && !displayedTrickPlays[selectedTrickCardIndex]) {
      setSelectedTrickCardIndex(null)
    }
  }, [displayedTrickPlays, selectedTrickCardIndex, winningDisplayedTrickCardIndex])

  useEffect(() => {
    const currentTrickIndex = game?.phase?.trickIndex
    const previousTrickIndex = previousTrickIndexRef.current

    if (
      typeof currentTrickIndex === 'number' &&
      typeof previousTrickIndex === 'number' &&
      currentTrickIndex > previousTrickIndex
    ) {
      shouldClearSelectedTrickCardAfterRevealRef.current = true
    }

    previousTrickIndexRef.current = currentTrickIndex
  }, [game?.phase?.trickIndex])

  useEffect(() => {
    const currentTrumpBroken =
      game?.phase && 'cards' in game.phase ? Boolean(game.phase.cards.trumpBroken) : null
    const previousTrumpBroken = previousTrumpBrokenRef.current

    if (previousTrumpBroken === false && currentTrumpBroken === true) {
      const celebrationId = `trump-broken-${game.id}-${Date.now()}`
      const hash = hashString(celebrationId)
      const driftDirection = hash % 2 === 0 ? 1 : -1
      const driftA = driftDirection * (20 + ((hash >> 3) % 12))
      const driftB = driftDirection * -1 * (16 + ((hash >> 6) % 16))
      const driftC = driftDirection * (28 + ((hash >> 9) % 16))

      setFloatingCelebrations((current) => [
        ...current,
        {
          id: celebrationId,
          message: 'Trump has been broken!',
          style: {
            left: '50%',
            bottom: `${mobileActionBarHeight + 48}px`,
            '--reaction-sway-a': `${driftA}px`,
            '--reaction-sway-b': `${driftB}px`,
            '--reaction-sway-c': `${driftC}px`,
          },
        },
      ])

      const timeoutId = window.setTimeout(() => {
        setFloatingCelebrations((current) =>
          current.filter((celebration) => celebration.id !== celebrationId),
        )
        floatingCelebrationTimeoutsRef.current = floatingCelebrationTimeoutsRef.current.filter(
          (currentTimeoutId) => currentTimeoutId !== timeoutId,
        )
      }, 7000)

      floatingCelebrationTimeoutsRef.current.push(timeoutId)
    }

    previousTrumpBrokenRef.current = currentTrumpBroken
  }, [game.id, game?.phase, mobileActionBarHeight])

  useEffect(() => {
    if (bookWinnerMessage || revealedCompletedTrick || !shouldClearSelectedTrickCardAfterRevealRef.current) {
      return
    }

    setSelectedTrickCardIndex(null)
    shouldClearSelectedTrickCardAfterRevealRef.current = false
  }, [bookWinnerMessage, revealedCompletedTrick])

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
    if (!selectedTrickPlay) {
      setSelectedTrickLabelStyle(null)
      return
    }

    const surfaceElement = trickSurfaceRef.current
    const cardButtonElement = trickCardButtonRefs.current[selectedTrickCardIndex]

    if (!surfaceElement || !cardButtonElement) {
      setSelectedTrickLabelStyle(null)
      return
    }

    const updateSelectedTrickLabelStyle = () => {
      const surfaceRect = surfaceElement.getBoundingClientRect()
      const cardRect = cardButtonElement.getBoundingClientRect()
      const horizontalPadding = 12
      const maxLabelWidth = Math.max(surfaceRect.width - horizontalPadding * 2, 0)
      const estimatedLabelWidth = Math.min(maxLabelWidth, 224)
      const measuredLabelWidth = selectedTrickLabelRef.current?.scrollWidth ?? estimatedLabelWidth
      const labelWidth = Math.min(maxLabelWidth, measuredLabelWidth)
      const cardCenter = cardRect.left + (cardRect.width / 2)
      const centeredLeft = cardCenter - (labelWidth / 2)
      const centeredRight = cardCenter + (labelWidth / 2)
      const minCenter = surfaceRect.left + horizontalPadding + (labelWidth / 2)
      const maxCenter = surfaceRect.right - horizontalPadding - (labelWidth / 2)
      const nextLabelStyle = {
        maxWidth: `${maxLabelWidth}px`,
      }
      const shouldEdgeAlign = labelWidth > cardRect.width

      if (shouldEdgeAlign && centeredLeft < surfaceRect.left + horizontalPadding) {
        const leftShift = Math.max((surfaceRect.left + horizontalPadding) - cardRect.left, 0)
        setSelectedTrickLabelStyle({
          ...nextLabelStyle,
          left: '0',
          textAlign: 'left',
          transform: `translateX(${leftShift}px)`,
        })
        return
      }

      if (shouldEdgeAlign && centeredRight > surfaceRect.right - horizontalPadding) {
        const rightShift = Math.min((surfaceRect.right - horizontalPadding) - cardRect.right, 0)
        setSelectedTrickLabelStyle({
          ...nextLabelStyle,
          left: '100%',
          textAlign: 'right',
          transform: `translateX(calc(-100% + ${rightShift}px))`,
        })
        return
      }

      setSelectedTrickLabelStyle({
        ...nextLabelStyle,
        left: '50%',
        textAlign: 'center',
        transform: 'translateX(-50%)',
      })
    }

    updateSelectedTrickLabelStyle()

    window.addEventListener('resize', updateSelectedTrickLabelStyle)
    surfaceElement.addEventListener('scroll', updateSelectedTrickLabelStyle, { passive: true })

    return () => {
      window.removeEventListener('resize', updateSelectedTrickLabelStyle)
      surfaceElement.removeEventListener('scroll', updateSelectedTrickLabelStyle)
    }
  }, [selectedTrickCardIndex, selectedTrickPlay, selectedTrickPlayerName, viewportWidth])

  useEffect(() => {
    const surfaceElement = trickSurfaceRef.current

    if (!surfaceElement || displayedTrickPlays.length === 0 || useScatterTrickLayout) {
      setPassiveTrickLabelStyles((current) => (current.length === 0 ? current : []))
      return
    }

    let settleTimeoutId = null

    const updatePassiveTrickLabelStyles = () => {
      const nextStyles = displayedTrickPlays.map((_, index) =>
        selectedTrickCardIndex === index ? null : getPassiveTrickLabelStyle(surfaceElement, index),
      )

      setPassiveTrickLabelStyles((current) => {
        if (
          current.length === nextStyles.length &&
          current.every((style, index) => JSON.stringify(style) === JSON.stringify(nextStyles[index]))
        ) {
          return current
        }

        return nextStyles
      })
    }

    updatePassiveTrickLabelStyles()
    settleTimeoutId = window.setTimeout(updatePassiveTrickLabelStyles, 180)

    window.addEventListener('resize', updatePassiveTrickLabelStyles)
    surfaceElement.addEventListener('scroll', updatePassiveTrickLabelStyles, { passive: true })

    return () => {
      if (settleTimeoutId !== null) {
        clearTimeout(settleTimeoutId)
      }
      window.removeEventListener('resize', updatePassiveTrickLabelStyles)
      surfaceElement.removeEventListener('scroll', updatePassiveTrickLabelStyles)
    }
  }, [displayedTrickPlays, isMobileViewport, selectedTrickCardIndex, useScatterTrickLayout, viewportWidth])

  useEffect(() => () => {
    clearReturningTrickLabelAnimation()
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
  const getPassiveTrickPlayerLabel = (playerName, index, playCount) => {
    const isOverlappedFromLeft = index > 0
    const isOverlappedFromRight = index < playCount - 1
    const maxLength =
      isMobileViewport
        ? playCount >= 4
          ? isOverlappedFromLeft && isOverlappedFromRight
            ? 7
            : 9
          : isOverlappedFromLeft && isOverlappedFromRight
            ? 8
            : isOverlappedFromLeft || isOverlappedFromRight
              ? 10
              : 12
        : isOverlappedFromLeft && isOverlappedFromRight
          ? 10
          : isOverlappedFromLeft || isOverlappedFromRight
            ? 13
            : 18

    return truncateLabel(playerName, maxLength)
  }

  const getPassiveTrickLabelStyle = (surfaceElement, index) => {
    const cardButtonElement = trickCardButtonRefs.current[index]
    if (!surfaceElement || !cardButtonElement) {
      return null
    }

    const surfaceRect = surfaceElement.getBoundingClientRect()
    const cardRect = cardButtonElement.getBoundingClientRect()
    const labelWidth = isMobileViewport ? 48 : 96

    return {
      left: `${cardRect.left - surfaceRect.left + (isMobileViewport ? 8 : 4)}px`,
      top: `${Math.max(cardRect.top - surfaceRect.top - 18, 0)}px`,
      width: `${labelWidth}px`,
    }
  }

  const clearReturningTrickLabelAnimation = () => {
    if (returningTrickLabelFrameRef.current) {
      cancelAnimationFrame(returningTrickLabelFrameRef.current)
      returningTrickLabelFrameRef.current = null
    }

    if (returningTrickLabelTimeoutRef.current) {
      clearTimeout(returningTrickLabelTimeoutRef.current)
      returningTrickLabelTimeoutRef.current = null
    }
  }

  const animateReturningTrickLabel = (fromIndex) => {
    const surfaceElement = trickSurfaceRef.current
    const selectedLabelElement = selectedTrickLabelRef.current
    const trickPlay = displayedTrickPlays[fromIndex]
    const targetStyle = getPassiveTrickLabelStyle(surfaceElement, fromIndex)

    if (!surfaceElement || !selectedLabelElement || !trickPlay || !targetStyle) {
      setReturningTrickLabel(null)
      return
    }

    const surfaceRect = surfaceElement.getBoundingClientRect()
    const labelRect = selectedLabelElement.getBoundingClientRect()
    const text = getPassiveTrickPlayerLabel(
      getPlayerName(game, trickPlay.playerId),
      fromIndex,
      displayedTrickPlays.length,
    )
    const key = `${trickPlay.playerId}-${fromIndex}-${Date.now()}`

    clearReturningTrickLabelAnimation()
    setReturningTrickLabel({
      key,
      text,
      style: {
        left: `${labelRect.left - surfaceRect.left}px`,
        top: `${labelRect.top - surfaceRect.top}px`,
        width: `${labelRect.width}px`,
      },
    })

    returningTrickLabelFrameRef.current = requestAnimationFrame(() => {
      returningTrickLabelFrameRef.current = null
      setReturningTrickLabel({
        key,
        text,
        style: {
          ...targetStyle,
          transition: 'left 180ms ease, top 180ms ease, width 180ms ease',
        },
      })
    })

    returningTrickLabelTimeoutRef.current = setTimeout(() => {
      setReturningTrickLabel(null)
      returningTrickLabelTimeoutRef.current = null
    }, 220)
  }

  const handleSelectTrickCard = (index) => {
    if (bookWinnerMessage) {
      return
    }

    setSelectedTrickCardIndex((currentIndex) => {
      const nextIndex = currentIndex === index ? null : index

      if (currentIndex !== null && currentIndex !== nextIndex) {
        animateReturningTrickLabel(currentIndex)
      } else {
        clearReturningTrickLabelAnimation()
        setReturningTrickLabel(null)
      }

      return nextIndex
    })
  }

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
      isHoldingTurnPlayerRef.current = false
      setBookWinnerMessage('')
      setRevealedCompletedTrick(null)
      setDisplayedTurnPlayerId(latestActualTurnPlayerIdRef.current)
      if (bookWinnerTimeoutRef.current) {
        clearTimeout(bookWinnerTimeoutRef.current)
        bookWinnerTimeoutRef.current = null
      }
    } else if (completedTricks.length > previousCompletedTrickCount && latestTrick?.winnerPlayerId) {
      isHoldingTurnPlayerRef.current = true
      setRevealedCompletedTrick(latestTrick)
      setBookWinnerMessage(
        latestTrick.winnerPlayerId === viewerPlayerId
          ? 'You won the book!'
          : `${getPlayerName(game, latestTrick.winnerPlayerId)} won the book.`,
      )
      if (bookWinnerTimeoutRef.current) {
        clearTimeout(bookWinnerTimeoutRef.current)
      }
      bookWinnerTimeoutRef.current = setTimeout(() => {
        isHoldingTurnPlayerRef.current = false
        setBookWinnerMessage('')
        setRevealedCompletedTrick(null)
        setDisplayedTurnPlayerId(latestActualTurnPlayerIdRef.current)
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
                      onClick={() => {
                        setSelectedReactionPhraseCategoryId(category.id)
                        setReactionPhraseOptions(
                          getRandomReactionPhrases(category.id, 3, hashString(`${category.id}:${trickPhraseSeed}`)),
                        )
                      }}
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
  const aiPauseUntilRef = useRef(0)
  const awayModalSessionKeyRef = useRef('')
  const wasLocalPlayerAwayRef = useRef(false)
  const aiPauseTimeoutRef = useRef(null)
  const previousCompletedTrickCountRef = useRef(0)
  const latestShownRoundIndexRef = useRef(-1)
  const lastDealtSortResetKeyRef = useRef('')
  const hydratedRoundSummaryGameIdRef = useRef('')
  const gameErrorTimeoutRef = useRef(null)
  const shareLinkCopiedTimeoutRef = useRef(null)
  const reactionCooldownTimeoutRef = useRef(null)
  const endOfRoundSummaryTimeoutRef = useRef(null)
  const gameOverScoreTimeoutRef = useRef(null)
  const previousLobbyMaxCardsRef = useRef(null)
  const isReactionOnCooldown = reactionCooldownUntil > Date.now()

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

  useEffect(() => () => {
    clearTimeoutRefs([
      shareLinkCopiedTimeoutRef,
      reactionCooldownTimeoutRef,
      endOfRoundSummaryTimeoutRef,
      gameOverScoreTimeoutRef,
    ])
  }, [])

  const clearActiveSessionState = () => {
    clearSessionState({
      timeoutRefs: [
        aiPauseTimeoutRef,
        gameErrorTimeoutRef,
        endOfRoundSummaryTimeoutRef,
        gameOverScoreTimeoutRef,
      ],
      trackingRefs: {
        aiPauseUntilRef,
        previousCompletedTrickCountRef,
        latestShownRoundIndexRef,
        hydratedRoundSummaryGameIdRef,
      },
      setOwnerSession,
      setPlayerSession,
      setGameError,
      setLobbyInfo,
      setPersistedEndOfRoundSummary,
      setIsEndOfRoundModalDismissed,
      setIsBidModalOpen,
    })
  }

  const handleRemovedFromGame = (gameId, message = "You have been removed from game " + gameId + ".") => {
    if (gameId) {
      clearStoredGameSession(gameId)
    }

    clearActiveSessionState()
    setSessionInfo(null)
    setRequestError(message)
    clearGameIdInUrl()
  }

  const applyRealtimeResult = (
    result,
    role = getActiveSessionRole({ ownerSession, playerSession }) ?? 'player',
  ) => {
    applyResultToSessionRole({
      role,
      result,
      setOwnerSession,
      setPlayerSession,
    })
  }

  const requestActiveStateReview = async ({ associateConnection = false } = {}) => {
    const { role, session: activeSession } = getActiveSessionContext({ ownerSession, playerSession })
    if (!activeSession?.gameId || !activeSession?.playerToken) {
      return
    }

    try {
      const result = role === 'owner'
        ? await checkState({
            gameId: activeSession.gameId,
            playerToken: activeSession.playerToken,
            associateConnection,
          })
        : await getGameState({
            gameId: activeSession.gameId,
            playerToken: activeSession.playerToken,
            version: activeSession.version ?? activeSession.game?.version ?? 0,
            associateConnection,
          })

      applyRealtimeResult(result, role ?? 'player')
    } catch (error) {
      const messageText = error instanceof Error ? error.message.toLowerCase() : ''
      if (messageText.includes('invalid player token') || messageText.includes('game not found')) {
        handleRemovedFromGame(activeSession.gameId)
        return
      }

      const message = toUserFacingActionError(error, 'Unable to refresh game state')
      setGameError(message)
    }
  }

  useEffect(() => {
    const { role, session } = getActiveSessionContext({ ownerSession, playerSession })

    if (session?.gameId && session?.playerToken && role) {
      setActiveGameSession({
        role,
        gameId: session.gameId,
        playerToken: session.playerToken,
      })
      return
    }

    setActiveGameSession(null)
  }, [ownerSession?.gameId, ownerSession?.playerToken, playerSession?.gameId, playerSession?.playerToken])

  useEffect(() => {
    return subscribeToGameEvents((event) => {
      if (event?.type === 'playerRemoved' || event?.type === 'gameRemoved') {
        handleRemovedFromGame(event.gameId, event.message)
        return
      }

      if (event?.type === 'sessionError') {
        const messageText = event.error instanceof Error ? event.error.message.toLowerCase() : ''
        if (messageText.includes('invalid player token') || messageText.includes('game not found')) {
          handleRemovedFromGame(event.gameId)
        }
        return
      }

      if (event?.type !== 'gameState' && event?.type !== 'sessionSync') {
        return
      }

      const { role, session: activeSession } = getActiveSessionContext({ ownerSession, playerSession })
      if (!activeSession?.gameId || event.gameId !== activeSession.gameId) {
        return
      }

      applyRealtimeResult(event.result, role ?? 'player')
    })
  }, [ownerSession, playerSession])

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
        const resumedSession = await returnFromAway({
          gameId: gameIdFromUrl,
          playerToken: storedSession.playerToken,
        })

        setSessionForRole({
          role: 'owner',
          session: buildOwnerSession({
            gameId: gameIdFromUrl,
            playerToken: storedSession.playerToken,
            game: resumedSession?.game ?? restoredSession.game,
            ownerPlayerId: resumedSession?.ownerPlayerId ?? restoredSession.ownerPlayerId,
          }),
          setOwnerSession,
          setPlayerSession,
        })
        setSelectedMaxCards(String(restoredSession.game?.options?.maxCards ?? 10))
        setSelectedAiDifficulty(restoredSession.game?.options?.aiDifficulty ?? 'medium')
        setIsJoinModalOpen(false)
        saveStoredGameSession(
          gameIdFromUrl,
          storedSession.playerToken,
          'owner',
          getRestoredPlayerName(restoredSession, storedSession.playerName ?? '', getViewerHand),
        )
        return
      }

      if (restoredSession?.role === 'player') {
        const resumedSession = await returnFromAway({
          gameId: gameIdFromUrl,
          playerToken: storedSession.playerToken,
        })

        setSessionForRole({
          role: 'player',
          session: buildPlayerSession({
            gameId: gameIdFromUrl,
            playerToken: storedSession.playerToken,
            game: resumedSession?.game ?? restoredSession.game,
            version: resumedSession?.version ?? restoredSession.version,
          }),
          setOwnerSession,
          setPlayerSession,
        })
        setIsJoinModalOpen(false)
        saveStoredGameSession(
          gameIdFromUrl,
          storedSession.playerToken,
          'player',
          getRestoredPlayerName(restoredSession, storedSession.playerName ?? '', getViewerHand),
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
            playerName: getRestoredPlayerName(normalized, storedSession.playerName ?? '', getViewerHand),
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
    const stage = activeGame?.phase?.stage
    const viewerCardCount = getViewerHand(activeGame)?.cards?.length ?? 0
    const dealKey =
      activeGame?.phase && 'cards' in activeGame.phase
        ? [
            activeGame.id,
            'roundIndex' in activeGame.phase ? activeGame.phase.roundIndex : 'no-round',
            activeGame.phase.cards.trump?.suit ?? 'no-trump-suit',
            activeGame.phase.cards.trump?.rank ?? 'no-trump-rank',
          ].join(':')
        : ''

    if ((stage !== 'Bidding' && stage !== 'Playing') || viewerCardCount === 0 || !dealKey) {
      return
    }

    if (lastDealtSortResetKeyRef.current === dealKey) {
      return
    }

    lastDealtSortResetKeyRef.current = dealKey
    setSortMode('byRank')
  }, [activeGame])

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

  useEffect(() => {
    if (!isOwnerLobby || ownerSession?.game?.phase?.stage !== 'Lobby') {
      previousLobbyMaxCardsRef.current = null
      return
    }

    const currentSelectedMaxCards = Number(selectedMaxCards)
    const previousLobbyMaxCards = previousLobbyMaxCardsRef.current
    previousLobbyMaxCardsRef.current = maxCardsForLobbySeatCount

    if (currentSelectedMaxCards <= maxCardsForLobbySeatCount) {
      if (
        previousLobbyMaxCards !== null &&
        maxCardsForLobbySeatCount > previousLobbyMaxCards &&
        currentSelectedMaxCards === previousLobbyMaxCards
      ) {
        setSelectedMaxCards(String(maxCardsForLobbySeatCount))
      }
      return
    }

    setSelectedMaxCards(String(maxCardsForLobbySeatCount))
  }, [
    isOwnerLobby,
    maxCardsForLobbySeatCount,
    orderedPlayers.length,
    ownerSession?.game?.phase?.stage,
    selectedMaxCards,
  ])

  useEffect(() => {
    if (awayModalSessionKeyRef.current !== activeSessionKey) {
      awayModalSessionKeyRef.current = activeSessionKey
      wasLocalPlayerAwayRef.current = Boolean(isLocalPlayerMarkedAway)
      setShowAwayContinueModal(false)
      return
    }

    if (!activeSessionKey) {
      wasLocalPlayerAwayRef.current = false
      setShowAwayContinueModal(false)
      return
    }

    if (!wasLocalPlayerAwayRef.current && isLocalPlayerMarkedAway) {
      setShowAwayContinueModal(true)
    } else if (!isLocalPlayerMarkedAway) {
      setShowAwayContinueModal(false)
    }

    wasLocalPlayerAwayRef.current = Boolean(isLocalPlayerMarkedAway)
  }, [activeSessionKey, isLocalPlayerMarkedAway])

  useEffect(() => {
    let isCancelled = false

    if (!isLobbyShareModalOpen || !shareLink) {
      setShareQrCodeDataUrl('')
      return undefined
    }

    QRCode.toDataURL(shareLink, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
      color: {
        dark: '#0f172a',
        light: '#f8fafc',
      },
    })
      .then((url) => {
        if (!isCancelled) {
          setShareQrCodeDataUrl(url)
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setShareQrCodeDataUrl('')
          setLobbyInfo('Unable to generate QR code.')
        }
      })

    return () => {
      isCancelled = true
    }
  }, [isLobbyShareModalOpen, shareLink])

  useEffect(() => {
    return () => {
      if (aiPauseTimeoutRef.current) {
        clearTimeout(aiPauseTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!activeLobbySession?.gameId || !activeLobbySession?.playerToken || !activeLobbySession?.game?.phase) {
      return undefined
    }

    if (activeLobbySession.game.phase.stage === 'Scoring') {
      const timeout = setTimeout(() => {
        void requestActiveStateReview()
      }, 0)

      return () => clearTimeout(timeout)
    }

    if (activeLobbySession.game.phase.stage === 'EndOfRound') {
      const delay = Math.max(0, (activeLobbySession.game.phase.advanceAfter ?? Date.now()) - Date.now())
      const timeout = setTimeout(() => {
        void requestActiveStateReview()
      }, delay)

      return () => clearTimeout(timeout)
    }

    return undefined
  }, [
    activeLobbySession?.gameId,
    activeLobbySession?.playerToken,
    activeLobbySession?.game?.phase?.stage,
    activeLobbySession?.game?.phase?.advanceAfter,
    ownerSession,
    playerSession,
  ])

  useEffect(() => {
    const completedTricks =
      activeGame?.phase && 'cards' in activeGame.phase ? activeGame.phase.cards.completedTricks ?? [] : []

    if (!activeLobbySession?.gameId || !activeGame) {
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
    }, TRICK_COMPLETE_DELAY_MS)
  }, [activeGame, activeLobbySession?.gameId, ownerSession, playerSession])

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

  const resetActiveSessionState = () => {
    clearActiveSessionState()
    setSessionInfo(null)
    clearGameIdInUrl()
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
    handleRejoinGame,
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
