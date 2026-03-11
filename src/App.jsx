import { useEffect, useMemo, useRef, useState } from 'react'
import {
  checkState,
  createGame,
  dealCards,
  getGameState,
  joinGame,
  movePlayer,
  playCard,
  removePlayer,
  sortCards,
  startGame,
  startOver,
  submitBid,
} from './api/lambdaClient'

const getPlayerName = (game, playerId) =>
  game?.players?.find((player) => player.id === playerId)?.name ?? 'Unknown'

const SUIT_SYMBOLS = {
  Hearts: '♥️',
  Diamonds: '♦️',
  Clubs: '♣️',
  Spades: '♠️',
  Joker: '⭐',
}

const SUIT_COLORS = {
  Hearts: 'text-red-700',
  Diamonds: 'text-red-700',
  Clubs: 'text-slate-900',
  Spades: 'text-slate-900',
  Joker: 'text-amber-500',
}

const getCardLabel = (card) => {
  if (!card?.rank || !card?.suit) {
    return 'Unknown card'
  }

  if (card.suit === 'Joker') {
    return card.rank === 'BJ' ? 'Big Joker' : card.rank === 'LJ' ? 'Little Joker' : 'Joker'
  }

  const suitLabel = card.suit.slice(0, -1) === 'Diamond' ? 'Diamonds' : card.suit
  return `${card.rank} of ${suitLabel}`
}

const getCardDisplay = (card) => {
  if (!card?.rank || !card?.suit) {
    return { rank: '?', suit: '', center: '?' }
  }

  if (card.suit === 'Joker') {
    return {
      rank: card.rank,
      suit: SUIT_SYMBOLS.Joker,
      center: SUIT_SYMBOLS.Joker,
      accent: card.rank === 'BJ' ? 'BIG' : 'LITTLE',
    }
  }

  return {
    rank: card.rank,
    suit: SUIT_SYMBOLS[card.suit],
    center: SUIT_SYMBOLS[card.suit],
  }
}

function CardAsset({
  card,
  className = '',
  showCornerSuit = true,
  showCenterSymbol = true,
  centerSymbolClassName = 'text-[124%] leading-none sm:text-[152%]',
}) {
  const label = getCardLabel(card)
  const display = getCardDisplay(card)
  const suitColorClass = SUIT_COLORS[card?.suit] ?? 'text-slate-900'

  return (
    <div
      aria-label={label}
      role="img"
      className={`relative h-full w-full overflow-hidden rounded-[10%] border-2 border-slate-800 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.28)] ${className}`}
    >
      <div className={`absolute left-[10%] top-[8%] flex flex-col leading-none ${suitColorClass}`}>
        <span className="text-[1.35rem] font-bold leading-none tracking-tight sm:text-[1.25rem]">{display.rank}</span>
        {showCornerSuit ? (
          <span className="mt-[0.2rem] text-[1rem] leading-none sm:mt-[0.35rem] sm:text-[0.825rem]">{display.suit}</span>
        ) : null}
      </div>
      <div className={`absolute bottom-[8%] right-[10%] flex rotate-180 flex-col leading-none ${suitColorClass}`}>
        <span className="text-[1.35rem] font-bold leading-none tracking-tight sm:text-[1.25rem]">{display.rank}</span>
        {showCornerSuit ? (
          <span className="mt-[0.2rem] text-[1rem] leading-none sm:mt-[0.35rem] sm:text-[0.825rem]">{display.suit}</span>
        ) : null}
      </div>
      <div className={`absolute inset-0 flex flex-col items-center justify-center ${suitColorClass}`}>
        {display.accent ? <span className="mb-[6%] text-[18%] font-semibold tracking-[0.14em]">{display.accent}</span> : null}
        {showCenterSymbol ? <span className={centerSymbolClassName}>{display.center}</span> : null}
        {display.accent ? <span className="mt-[4%] text-[18%] font-semibold tracking-[0.12em]">JOKER</span> : null}
      </div>
    </div>
  )
}

function CardBack({ className = '' }) {
  return (
    <div
      aria-label="Face-down deck"
      role="img"
      className={`relative h-full w-full overflow-hidden rounded-[10%] border-2 border-slate-800 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.28)] ${className}`}
    >
      <div
        className="absolute inset-[7%] rounded-[8%] border-2 border-white bg-red-800"
        style={{
          backgroundColor: '#b91c1c',
          backgroundImage:
            'linear-gradient(45deg, rgba(255,255,255,0.25) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.25) 75%), linear-gradient(45deg, rgba(255,255,255,0.25) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.25) 75%)',
          backgroundPosition: '0 0, 10px 10px',
          backgroundSize: '20px 20px',
        }}
      >
        <div className="absolute inset-[6%] rounded-[6%] border border-red-100/90" />
      </div>
    </div>
  )
}

function ScoreSummary({ game, bids, booksByPlayerId, currentRoundIndex }) {
  const playersById = new Map((game.players ?? []).map((player) => [player.id, player]))
  const orderedPlayers =
    (game.playerOrder ?? [])
      .map((playerId) => playersById.get(playerId))
      .filter(Boolean)

  return (
    <ul className="mt-3 flex flex-col gap-2">
      {(orderedPlayers.length > 0 ? orderedPlayers : game.players ?? []).map((player) => {
        const score = game.scores?.find((entry) => entry.playerId === player.id)
        const playerBidEntry = bids.find((bid) => bid.playerId === player.id)
        const playerBid =
          playerBidEntry?.trip === true
            ? 'T'
            : typeof playerBidEntry?.amount === 'number'
              ? playerBidEntry.amount
              : score?.rounds?.[currentRoundIndex]?.bid ?? '-'
        const playerBooks =
          booksByPlayerId.get(player.id) ?? score?.rounds?.[currentRoundIndex]?.books ?? 0

        return (
          <li key={player.id} className="rounded border panel-surface-strong px-3 py-2 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{player.name}</p>
                <p className="mt-1 text-lg font-semibold text-white">{score?.total ?? 0}</p>
              </div>
              <div className="flex flex-col items-end gap-1 text-xs text-muted">
                <p>
                  <span className="uppercase tracking-wide text-dim">Bid</span>{' '}
                  <span className="ml-3 text-sm text-white">{playerBid}</span>
                </p>
                <p>
                  <span className="uppercase tracking-wide text-dim">Books</span>{' '}
                  <span className="ml-3 text-sm text-white">{playerBooks}</span>
                </p>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

const GAME_SESSIONS_STORAGE_KEY = 'setback.gameSessions.v1'

const readStoredSessions = () => {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const raw = window.localStorage.getItem(GAME_SESSIONS_STORAGE_KEY)
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

const writeStoredSessions = (sessions) => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(GAME_SESSIONS_STORAGE_KEY, JSON.stringify(sessions))
}

const saveStoredGameSession = (gameId, playerToken, role) => {
  if (!gameId || !playerToken) {
    return
  }

  const sessions = readStoredSessions()
  sessions[gameId] = {
    playerToken,
    role,
    updatedAt: Date.now(),
  }
  writeStoredSessions(sessions)
}

const getStoredGameSession = (gameId) => {
  if (!gameId) {
    return null
  }

  const sessions = readStoredSessions()
  const session = sessions[gameId]
  if (!session || typeof session.playerToken !== 'string' || !session.playerToken.trim()) {
    return null
  }

  return session
}

const clearStoredGameSession = (gameId) => {
  if (!gameId) {
    return
  }

  const sessions = readStoredSessions()
  delete sessions[gameId]
  writeStoredSessions(sessions)
}

const isGameNotFoundError = (error) => {
  const message = error instanceof Error ? error.message : ''
  return message.toLowerCase().includes('game not found')
}

const isInvalidPlayerTokenError = (error) => {
  const message = error instanceof Error ? error.message : ''
  return message.toLowerCase().includes('invalid player token')
}

const isOwnerTokenRequiredError = (error) => {
  const message = error instanceof Error ? error.message : ''
  return message.toLowerCase().includes('owner token required')
}

const pruneMissingStoredGameSessions = async () => {
  const storedSessions = readStoredSessions()
  const entries = Object.entries(storedSessions)

  if (entries.length === 0) {
    return storedSessions
  }

  const nextSessions = { ...storedSessions }

  await Promise.all(
    entries.map(async ([gameId, storedSession]) => {
      if (typeof storedSession?.playerToken !== 'string' || !storedSession.playerToken.trim()) {
        delete nextSessions[gameId]
        return
      }

      try {
        await getGameState({
          gameId,
          playerToken: storedSession.playerToken,
          version: 0,
        })
      } catch (error) {
        if (isGameNotFoundError(error) || isInvalidPlayerTokenError(error)) {
          delete nextSessions[gameId]
        }
      }
    }),
  )

  writeStoredSessions(nextSessions)
  return nextSessions
}

const getGameIdFromUrl = () => {
  if (typeof window === 'undefined') {
    return ''
  }

  const params = new URL(window.location.href).searchParams
  return params.get('gameid')?.trim() ?? params.get('gameId')?.trim() ?? ''
}

const setGameIdInUrl = (gameId) => {
  if (typeof window === 'undefined' || !gameId) {
    return
  }

  const url = new URL(window.location.href)
  url.searchParams.set('gameid', gameId)
  url.searchParams.delete('gameId')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

const clearGameIdInUrl = () => {
  if (typeof window === 'undefined') {
    return
  }

  const url = new URL(window.location.href)
  url.searchParams.delete('gameid')
  url.searchParams.delete('gameId')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

const AI_ACTION_DELAY_MS = 1500
const TRICK_COMPLETE_DELAY_MS = 5000

const getRoundDirectionArrow = (direction) => (direction === 'up' ? '⬆' : '⬇')

const getCompletedRoundCount = (game) =>
  Array.isArray(game?.scores) ? Math.max(0, ...game.scores.map((score) => score?.rounds?.length ?? 0)) : 0

const buildRoundSummary = (game, roundIndex) => {
  if (!game || roundIndex < 0) {
    return null
  }

  const roundConfig = game.options?.rounds?.[roundIndex]
  if (!roundConfig) {
    return null
  }

  return {
    roundIndex,
    cardCount: roundConfig.cardCount,
    direction: roundConfig.direction,
    players: (game.playerOrder ?? []).map((playerId) => {
      const player = game.players?.find((entry) => entry.id === playerId)
      const roundResult = game.scores?.find((score) => score.playerId === playerId)?.rounds?.[roundIndex]

      return {
        playerId,
        name: player?.name ?? 'Unknown',
        bid: roundResult?.bid ?? 0,
        books: roundResult?.books ?? 0,
        score: roundResult?.total ?? 0,
      }
    }),
  }
}

const normalizeStoredSessionGame = async (gameId, playerToken, preferredRole) => {
  const tryOwnerRestore = async () => {
    const ownerResult = await checkState({
      gameId,
      playerToken,
    })

    if (!ownerResult?.game) {
      return null
    }

    const ownerPlayerId = ownerResult.game.players?.find((player) => player.type === 'human')?.id ?? ''
    return {
      role: 'owner',
      game: ownerResult.game,
      playerToken,
      ownerPlayerId,
    }
  }

  const tryPlayerRestore = async () => {
    const playerResult = await getGameState({
      gameId,
      playerToken,
      version: 0,
    })

    if (!playerResult?.game) {
      return null
    }

    return {
      role: 'player',
      game: playerResult.game,
      playerToken,
      version: playerResult?.version ?? playerResult.game?.version ?? 0,
    }
  }

  if (preferredRole === 'player') {
    try {
      return await tryPlayerRestore()
    } catch {
      return null
    }
  }

  if (preferredRole === 'owner') {
    try {
      return await tryOwnerRestore()
    } catch (error) {
      if (
        isGameNotFoundError(error) ||
        isInvalidPlayerTokenError(error) ||
        isOwnerTokenRequiredError(error)
      ) {
        return null
      }
    }

    return null
  }

  try {
    const ownerSession = await tryOwnerRestore()
    if (ownerSession) {
      return ownerSession
    }
  } catch {
    // Fallback to player lookup below.
  }

  try {
    return await tryPlayerRestore()
  } catch {
    return null
  }
}

const getViewerHand = (game) => {
  if (!game?.phase || !('cards' in game.phase)) {
    return null
  }

  return game.phase.cards.hands?.[0] ?? null
}

function GameTablePage({
  game,
  isOwner,
  onDealCards,
  onSubmitBid,
  onPlayCard,
  onSortCards,
  onStartOver,
  onOpenNewGame,
  onOpenJoinGame,
  isDealingCards,
  isStartingOver,
  isSubmittingBid,
  isPlayingCard,
  isSortingCards,
}) {
  const viewerHand = getViewerHand(game)
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 1024 : window.innerWidth,
  )
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false)
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
  const [bookWinnerMessage, setBookWinnerMessage] = useState('')
  const previousCompletedTrickCountRef = useRef(0)
  const bookWinnerTimeoutRef = useRef(null)

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
  const displayedTrick = bookWinnerMessage && latestCompletedTrick ? latestCompletedTrick : currentTrick
  const displayedTrickPlays = displayedTrick?.plays ?? []
  const winningDisplayedTrickCardIndex =
    bookWinnerMessage && latestCompletedTrick?.winnerPlayerId
      ? latestCompletedTrick.plays.findIndex((play) => play.playerId === latestCompletedTrick.winnerPlayerId)
      : null
  const selectedCard =
    selectedCardIndex !== null && viewerHand?.cards?.[selectedCardIndex]
      ? viewerHand.cards[selectedCardIndex]
      : null
  const handCardCount = viewerHand?.cards?.length ?? 0
  const isMobileViewport = viewportWidth < 640
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
  }, [game.phase?.stage, currentTurnPlayerId])

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
    const latestTrick = completedTricks[completedTricks.length - 1]

    if (completedTricks.length > previousCompletedTrickCountRef.current && latestTrick?.winnerPlayerId) {
      setBookWinnerMessage(`${getPlayerName(game, latestTrick.winnerPlayerId)} won the book!`)
      if (bookWinnerTimeoutRef.current) {
        clearTimeout(bookWinnerTimeoutRef.current)
      }
      bookWinnerTimeoutRef.current = setTimeout(() => {
        setBookWinnerMessage('')
        bookWinnerTimeoutRef.current = null
      }, TRICK_COMPLETE_DELAY_MS)
    }

    previousCompletedTrickCountRef.current = completedTricks.length
  }, [game?.version])

  useEffect(() => {
    if ((currentTrick?.plays ?? []).length > 0) {
      setBookWinnerMessage('')
    }
  }, [currentTrick?.plays])

  useEffect(() => {
    return () => {
      if (bookWinnerTimeoutRef.current) {
        clearTimeout(bookWinnerTimeoutRef.current)
      }
    }
  }, [])

  const availableActions = (() => {
    switch (game.phase?.stage) {
      case 'Dealing':
        return isViewerTurn ? ['Deal Cards'] : ['Waiting for dealer']
      case 'Bidding':
        return isViewerTurn ? ['Submit Bid'] : ['Waiting for turn to bid']
      case 'Playing':
        return isViewerTurn ? ['Play Card'] : ['Waiting for turn to play']
      case 'Scoring':
        return ['Waiting for scoring to complete']
      case 'GameOver':
        return isOwner ? ['Start Over'] : ['Game is over']
      default:
        return []
    }
  })()

  const canSortCards = game.phase?.stage !== 'Dealing' && (viewerHand?.cards?.length ?? 0) > 0 && typeof onSortCards === 'function'

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
    <main className="theme-shell h-screen overflow-hidden px-3 py-3">
      <section className="mx-auto flex h-full w-full max-w-6xl flex-col pb-24">
        <div className="table-surface flex h-full min-h-0 flex-col rounded-[28px] border p-4 sm:p-5">
        <article className="shrink-0 p-1">
          <div className="flex items-start justify-between gap-4 text-sm text-muted">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <img
                src="/logo-512x512.png"
                alt="Setback"
                className="h-20 w-20 shrink-0 rounded-md"
              />
            </div>
            {trumpCard ? (
              <div className="flex shrink-0 items-center gap-2 self-start">
                <p className="text-sm text-dim">Trump</p>
                <div className="relative h-[84px] w-[78px] shrink-0">
                  <div className="absolute left-0 top-0 h-[84px] w-[60px]">
                    <CardBack />
                  </div>
                  <div className="absolute top-0 h-[84px] w-[60px]" style={{ left: '0.75rem' }}>
                    <CardAsset card={trumpCard} showCornerSuit={false} />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </article>

        <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[30%_1fr]">
          <article className="hidden min-h-0 overflow-hidden rounded-2xl border border-white/10 bg-black/5 pb-4 pl-4 pr-1 pt-4 md:block">
            <div className="score-scroll h-full overflow-auto pr-1">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Score</h2>
                {currentRoundConfig ? (
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
              />
            </div>
          </article>

          <article className="flex min-h-0 flex-col p-1">
            <div className="mb-3 flex min-h-7 items-center justify-center">
              {isViewerTurn ? (
                <p className="status-info px-6 py-2 text-xl font-semibold">
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
            {bookWinnerMessage ? (
              <div className="mb-3 flex items-center justify-center">
                <p className="text-center text-lg text-[#d8e6ff]">{bookWinnerMessage}</p>
              </div>
            ) : null}
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
                        <CardAsset card={play.card} />
                      </div>
                    </button>
                  </li>
                ))
              ) : (
                <li className="self-center text-sm text-dim">No cards played in this trick yet.</li>
              )}
            </ul>
          </article>
        </div>

        <article className="shrink-0 overflow-hidden p-1 sm:overflow-x-auto">
          <div className="flex items-end justify-center pt-5 pb-2">
            {(viewerHand?.cards ?? []).length > 0 ? (
              viewerHand.cards.map((card, index) => (
                <button
                  key={`${card.rank}-${card.suit}-${index}`}
                  type="button"
                  onClick={() => {
                    if (!canSelectCards) {
                      return
                    }
                    setSelectedCardIndex((currentIndex) => (currentIndex === index ? null : index))
                  }}
                  disabled={!canSelectCards || isPlayingCard}
                  className={`relative shrink-0 overflow-visible rounded-lg bg-transparent p-0 transition-transform duration-150 ${
                    selectedCardIndex === index
                      ? '-translate-y-4'
                      : 'translate-y-0'
                  }`}
                  style={{
                    marginLeft: index === 0 ? '0' : handLayout.overlapOffset,
                    zIndex: selectedCardIndex === index ? 100 : index + 1,
                  }}
                  aria-label={getCardLabel(card)}
                >
                  <div
                    className={`aspect-[2.5/3.5] ${handLayout.useCompactSizing ? '' : 'w-20 sm:w-24'}`}
                    style={handLayout.useCompactSizing ? { width: handLayout.cardWidth } : undefined}
                  >
                    <CardAsset
                      card={card}
                      showCenterSymbol={!handLayout.useCompactSizing}
                      centerSymbolClassName="text-[104%] leading-none sm:text-[132%]"
                    />
                  </div>
                </button>
              ))
            ) : (
              <p className="text-sm text-dim">No cards in hand yet.</p>
            )}
          </div>
        </article>
        </div>
      </section>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t panel-surface px-3 py-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="btn-secondary min-h-12 px-4 py-3 text-sm"
              onClick={() => setIsMenuModalOpen(true)}
              aria-label="Open game menu"
            >
              ☰
            </button>
            <button
              type="button"
              className="btn-secondary min-h-12 px-4 py-3 text-sm md:hidden"
              onClick={() => setIsScoreModalOpen(true)}
            >
              Score
            </button>
          </div>
          {canSortCards ? (
            <button
              type="button"
              className="btn-secondary min-h-12 px-4 py-3 text-sm disabled:opacity-50"
              onClick={onSortCards}
              disabled={isSortingCards}
            >
              {isSortingCards ? 'Sorting...' : 'Sort'}
            </button>
          ) : null}
          <div className="flex flex-wrap justify-center gap-2">
            {availableActions.length > 0 ? (
              availableActions.map((action) => {
                const isDisabled =
                  !isActionEnabled(action) ||
                  isDealingCards ||
                  isSubmittingBid ||
                  isPlayingCard ||
                  isSortingCards ||
                  isStartingOver
                const shouldFlashDealButton = action === 'Deal Cards' && isViewerTurn && !isDisabled

                return (
                  <button
                    key={action}
                    type="button"
                    className={`min-h-12 rounded-md border px-4 py-3 text-sm text-white disabled:opacity-50 ${
                      shouldFlashDealButton
                        ? 'animate-pulse border-[#4d86ee] bg-[#2f6fdb]/25 shadow-[0_0_18px_rgba(47,111,219,0.45)]'
                        : 'btn-secondary'
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
                          : action}
                  </button>
                )
              })
            ) : (
              <button
                type="button"
                className="btn-secondary min-h-12 px-4 py-3 text-sm"
                disabled
              >
                No actions available
              </button>
            )}
          </div>
        </div>
      </div>
      {isScoreModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 md:hidden"
          onClick={() => setIsScoreModalOpen(false)}
        >
          <div
            className="dialog-surface w-full max-w-md rounded-xl p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Score</h2>
              {currentRoundConfig ? (
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
            />
          </div>
        </div>
      )}
      {isMenuModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => setIsMenuModalOpen(false)}
        >
          <div
            className="dialog-surface w-full max-w-sm p-6 text-left"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-xl font-semibold">Menu</h2>
            <div className="mt-4 flex flex-col gap-3">
              <button
                type="button"
                className="btn-secondary px-4 py-3 text-left"
                onClick={() => {
                  setIsMenuModalOpen(false)
                  onOpenNewGame?.()
                }}
              >
                New Game
              </button>
              <button
                type="button"
                className="btn-secondary px-4 py-3 text-left"
                onClick={() => {
                  setIsMenuModalOpen(false)
                  onOpenJoinGame?.()
                }}
              >
                Join Game
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default function App() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false)
  const [isRejoinModalOpen, setIsRejoinModalOpen] = useState(false)
  const [playerName, setPlayerName] = useState('')
  const [maxCards, setMaxCards] = useState('10')
  const [joinGameId, setJoinGameId] = useState('')
  const [selectedRejoinGameId, setSelectedRejoinGameId] = useState('')
  const [joinPlayerName, setJoinPlayerName] = useState('')
  const [createErrors, setCreateErrors] = useState({})
  const [joinErrors, setJoinErrors] = useState({})
  const [isCreatingGame, setIsCreatingGame] = useState(false)
  const [isJoiningGame, setIsJoiningGame] = useState(false)
  const [isRejoiningGame, setIsRejoiningGame] = useState(false)
  const [isLoadingRejoinGames, setIsLoadingRejoinGames] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [sessionInfo, setSessionInfo] = useState(null)
  const [rejoinableGames, setRejoinableGames] = useState([])

  const [ownerSession, setOwnerSession] = useState(null)
  const [playerSession, setPlayerSession] = useState(null)
  const [lobbyError, setLobbyError] = useState('')
  const [lobbyInfo, setLobbyInfo] = useState('')
  const [isStartingGame, setIsStartingGame] = useState(false)
  const [isDealingCards, setIsDealingCards] = useState(false)
  const [isBidModalOpen, setIsBidModalOpen] = useState(false)
  const [isSortModalOpen, setIsSortModalOpen] = useState(false)
  const [selectedBid, setSelectedBid] = useState('0')
  const [isSubmittingBid, setIsSubmittingBid] = useState(false)
  const [isPlayingCard, setIsPlayingCard] = useState(false)
  const [isSortingCards, setIsSortingCards] = useState(false)
  const [isStartingOver, setIsStartingOver] = useState(false)
  const [isEndOfRoundModalDismissed, setIsEndOfRoundModalDismissed] = useState(false)
  const [pendingPlayerActionId, setPendingPlayerActionId] = useState('')
  const [selectedDealerPlayerId, setSelectedDealerPlayerId] = useState('')
  const aiPauseUntilRef = useRef(0)
  const aiPauseTimeoutRef = useRef(null)
  const previousCompletedTrickCountRef = useRef(0)

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
        setSelectedDealerPlayerId(restoredSession.ownerPlayerId)
        setPlayerSession(null)
        setIsJoinModalOpen(false)
        saveStoredGameSession(gameIdFromUrl, storedSession.playerToken, 'owner')
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
        saveStoredGameSession(gameIdFromUrl, storedSession.playerToken, 'player')
        return
      }

      clearStoredGameSession(gameIdFromUrl)
      if (!isCancelled) {
        setIsJoinModalOpen(true)
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
          : nextRejoinableGames[0]?.gameId ?? '',
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
    setMaxCards('10')
    setCreateErrors({})
  }

  const closeJoinModal = () => {
    setIsJoinModalOpen(false)
    setJoinGameId('')
    setJoinPlayerName('')
    setJoinErrors({})
  }

  const closeRejoinModal = () => {
    setIsRejoinModalOpen(false)
  }

  const handleCreateGame = async (event) => {
    event.preventDefault()
    const errors = {}

    if (!playerName.trim()) {
      errors.playerName = 'Player Name is required.'
    }

    if (!maxCards) {
      errors.maxCards = 'Max Cards is required.'
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
        playerName: playerName.trim(),
        maxCards: Number(maxCards),
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
      setSelectedDealerPlayerId(
        result?.game?.players?.find((player) => player.type === 'human')?.id ?? '',
      )
      setPlayerSession(null)
      setLobbyError('')
      setLobbyInfo('')
      setGameIdInUrl(result?.game?.id)
      saveStoredGameSession(result?.game?.id, result?.playerToken, 'owner')
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
    const errors = {}

    if (!joinGameId.trim()) {
      errors.gameId = 'Game ID is required.'
    }

    if (!joinPlayerName.trim()) {
      errors.playerName = 'Player Name is required.'
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
        playerName: joinPlayerName.trim(),
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
      setLobbyError('')
      setLobbyInfo('')
      setGameIdInUrl(result?.game?.id)
      saveStoredGameSession(result?.game?.id, result?.playerToken, 'player')
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
        setSelectedDealerPlayerId(restoredSession.ownerPlayerId)
        setPlayerSession(null)
        saveStoredGameSession(selectedGame.gameId, selectedGame.playerToken, 'owner')
      } else {
        setPlayerSession({
          gameId: selectedGame.gameId,
          playerToken: selectedGame.playerToken,
          game: restoredSession.game,
          version: restoredSession.version,
        })
        setOwnerSession(null)
        saveStoredGameSession(selectedGame.gameId, selectedGame.playerToken, 'player')
      }

      setSessionInfo({
        action: 'rejoinGame',
        gameId: selectedGame.gameId,
      })
      setLobbyError('')
      setLobbyInfo('')
      setGameIdInUrl(selectedGame.gameId)
      closeRejoinModal()
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
      const message = error instanceof Error ? error.message : 'Unable to refresh game state'
      setLobbyError(message)
    }
  }

  const refreshPlayerGame = async () => {
    if (!playerSession?.gameId || !playerSession?.playerToken) {
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
      const message = error instanceof Error ? error.message : 'Unable to refresh game state'
      setLobbyError(message)
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
  }, [ownerSession?.gameId, ownerSession?.playerToken])

  useEffect(() => {
    if (!ownerSession?.ownerPlayerId) {
      return
    }

    if (!selectedDealerPlayerId) {
      setSelectedDealerPlayerId(ownerSession.ownerPlayerId)
    }
  }, [ownerSession?.ownerPlayerId, selectedDealerPlayerId])

  useEffect(() => {
    if (!playerSession?.gameId || !playerSession?.playerToken) {
      return undefined
    }

    refreshPlayerGame()

    const interval = setInterval(() => {
      refreshPlayerGame()
    }, AI_ACTION_DELAY_MS)

    return () => clearInterval(interval)
  }, [playerSession?.gameId, playerSession?.playerToken, playerSession?.version])

  const activeLobbySession = ownerSession ?? playerSession
  const isOwnerLobby = Boolean(ownerSession)
  const activeGame = activeLobbySession?.game
  const activeRoundIndex =
    activeGame?.phase && 'roundIndex' in activeGame.phase ? activeGame.phase.roundIndex : 0
  const currentRoundCardCount = activeGame?.options?.rounds?.[activeRoundIndex]?.cardCount ?? 0
  const isTripRound = [1, 2, 3].includes(currentRoundCardCount)
  const endOfRoundSummary =
    activeGame?.phase?.stage === 'EndOfRound'
      ? buildRoundSummary(activeGame, activeGame.phase.roundIndex)
      : null

  useEffect(() => {
    setIsEndOfRoundModalDismissed(false)
  }, [activeGame?.phase?.stage, endOfRoundSummary?.roundIndex])

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
      setLobbyInfo('Share link copied.')
    } catch {
      setLobbyInfo('Unable to copy automatically. Copy the link manually.')
    }
  }

  const handleMovePlayer = async (playerId, direction) => {
    if (!ownerSession?.gameId || !ownerSession?.playerToken) {
      return
    }

    setLobbyError('')
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
      setLobbyError(message)
    } finally {
      setPendingPlayerActionId('')
    }
  }

  const handleRemovePlayer = async (playerId) => {
    if (!ownerSession?.gameId || !ownerSession?.playerToken) {
      return
    }

    setLobbyError('')
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to remove player'
      setLobbyError(message)
    } finally {
      setPendingPlayerActionId('')
    }
  }

  const handleStartGame = async () => {
    if (!ownerSession?.gameId || !ownerSession?.playerToken) {
      return
    }

    setLobbyError('')
    setLobbyInfo('')
    setIsStartingGame(true)

    try {
      const result = await startGame({
        gameId: ownerSession.gameId,
        playerToken: ownerSession.playerToken,
        dealerPlayerId: selectedDealerPlayerId || undefined,
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
      setLobbyError(message)
    } finally {
      setIsStartingGame(false)
    }
  }

  const resetActiveSessionState = () => {
    const activeGameId = ownerSession?.gameId ?? playerSession?.gameId
    if (activeGameId) {
      clearStoredGameSession(activeGameId)
    }

    if (aiPauseTimeoutRef.current) {
      clearTimeout(aiPauseTimeoutRef.current)
      aiPauseTimeoutRef.current = null
    }

    aiPauseUntilRef.current = 0
    previousCompletedTrickCountRef.current = 0
    setOwnerSession(null)
    setPlayerSession(null)
    setLobbyError('')
    setLobbyInfo('')
    clearGameIdInUrl()
  }

  const handleStartOver = async () => {
    if (!ownerSession?.gameId || !ownerSession?.playerToken) {
      return
    }

    setLobbyError('')
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
      setSelectedDealerPlayerId(ownerSession.ownerPlayerId ?? '')
      setLobbyInfo('Game reset to lobby.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start over'
      setLobbyError(message)
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

    setLobbyError('')
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
      const message = error instanceof Error ? error.message : 'Unable to deal cards'
      setLobbyError(message)
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

  const openSortCardsModal = () => {
    setIsSortModalOpen(true)
  }

  const closeSortCardsModal = () => {
    setIsSortModalOpen(false)
  }

  const handleSubmitBid = async (event) => {
    event.preventDefault()

    const activeSession = ownerSession ?? playerSession
    if (!activeSession?.gameId || !activeSession?.playerToken) {
      return
    }

    setLobbyError('')
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
      const message = error instanceof Error ? error.message : 'Unable to submit bid'
      setLobbyError(message)
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

    setLobbyError('')
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

      closeSortCardsModal()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sort cards'
      setLobbyError(message)
    } finally {
      setIsSortingCards(false)
    }
  }

  const handlePlayCard = async (card) => {
    const activeSession = ownerSession ?? playerSession
    if (!activeSession?.gameId || !activeSession?.playerToken) {
      return
    }

    setLobbyError('')
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
      const message = error instanceof Error ? error.message : 'Unable to play card'
      setLobbyError(message)
    } finally {
      setIsPlayingCard(false)
    }
  }

  const currentDealerPlayerId = ownerSession?.game?.phase?.dealerPlayerId ?? selectedDealerPlayerId

  if (activeGame && activeGame.phase?.stage !== 'Lobby') {
    return (
      <>
        <GameTablePage
          game={activeGame}
          isOwner={Boolean(ownerSession)}
          onDealCards={handleDealCards}
          onSubmitBid={openSubmitBidModal}
          onPlayCard={handlePlayCard}
          onSortCards={openSortCardsModal}
          onStartOver={handleStartOver}
          onOpenNewGame={handleOpenNewGame}
          onOpenJoinGame={handleOpenJoinGame}
          isDealingCards={isDealingCards}
          isStartingOver={isStartingOver}
          isSubmittingBid={isSubmittingBid}
          isPlayingCard={isPlayingCard}
          isSortingCards={isSortingCards}
        />

        {isBidModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
            onClick={closeSubmitBidModal}
          >
            <div
              className="dialog-surface w-full max-w-md p-6 text-left"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 className="text-xl font-semibold">Submit Bid</h2>
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
        {isSortModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
            onClick={closeSortCardsModal}
          >
            <div
              className="dialog-surface w-full max-w-sm p-6 text-left"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 className="text-xl font-semibold">Sort Cards</h2>
              <div className="mt-4 flex flex-col gap-3">
                <button
                  type="button"
                  className="btn-secondary px-4 py-3 text-left disabled:opacity-50"
                  onClick={() => handleSortCards('bySuit')}
                  disabled={isSortingCards}
                >
                  Sort by Suit
                </button>
                <button
                  type="button"
                  className="btn-secondary px-4 py-3 text-left disabled:opacity-50"
                  onClick={() => handleSortCards('byRank')}
                  disabled={isSortingCards}
                >
                  Sort by Rank
                </button>
              </div>
            </div>
          </div>
        )}
        {endOfRoundSummary && !isEndOfRoundModalDismissed && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          >
            <div
              className="dialog-surface w-full max-w-lg p-6 text-left"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 className="text-xl font-semibold">
                {`End of Round ${endOfRoundSummary.cardCount} ${getRoundDirectionArrow(endOfRoundSummary.direction)}`}
              </h2>
              <ul className="mt-4 flex flex-col gap-2">
                {endOfRoundSummary.players.map((player) => (
                  <li
                    key={player.playerId}
                    className="panel-surface-strong rounded-md border px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-white">{player.name}</p>
                      <div className="flex items-center gap-4 text-sm text-muted">
                        <span>{`Bid ${player.bid}`}</span>
                        <span>{`Books ${player.books}`}</span>
                        <span className="font-medium text-white">{`Score ${player.score}`}</span>
                      </div>
                    </div>
                  </li>
                ))}
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
      </>
    )
  }

  if (activeLobbySession?.gameId && activeLobbySession?.game) {
    return (
      <main className="theme-shell min-h-screen px-4 py-8">
        <section className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          <header className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight">
              {isOwnerLobby ? 'Game Owner Lobby' : 'Game Lobby'}
            </h1>
            <p className="text-muted">Game ID: {activeLobbySession.gameId}</p>
            <p className="text-muted">Phase: {activeLobbySession.game.phase?.stage}</p>
          </header>

          {lobbyError && (
            <p className="status-error">
              {lobbyError}
            </p>
          )}
          {lobbyInfo && (
            <p className="status-info">
              {lobbyInfo}
            </p>
          )}

          <section className="panel-surface rounded-lg border p-4">
            <h2 className="text-lg font-semibold">Share Link</h2>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                readOnly
                value={shareLink}
                className="input-surface w-full text-sm"
              />
              <button
                type="button"
                className="btn-primary px-4 py-2 text-sm"
                onClick={handleCopyShareLink}
              >
                Copy Link
              </button>
            </div>
          </section>

          <section className="panel-surface rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">Players</h2>
              {isOwnerLobby && (
                <label className="flex items-center gap-2 text-sm text-muted">
                  <span>Dealer</span>
                  <select
                    value={selectedDealerPlayerId}
                    onChange={(event) => setSelectedDealerPlayerId(event.target.value)}
                    disabled={isStartingGame || ownerSession.game.phase?.stage !== 'Lobby'}
                    className="input-surface px-3 py-1.5 text-sm disabled:opacity-50"
                    aria-label="Select dealer"
                  >
                    {orderedPlayers.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              {orderedPlayers.map((player) => {
                const isPending = pendingPlayerActionId === player.id
                return (
                  <li
                    key={player.id}
                    className={`panel-surface-strong rounded-md border px-3 py-3 ${
                      isOwnerLobby
                        ? 'grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center'
                        : 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{player.name}</span>
                      <span className="rounded border px-2 py-0.5 text-xs uppercase tracking-wide text-muted" style={{ borderColor: 'var(--border-color)' }}>
                        {player.type}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {isOwnerLobby && (
                        <>
                          <button
                            type="button"
                            className="btn-secondary px-3 py-1.5 text-xl font-black disabled:opacity-50"
                            onClick={() => handleMovePlayer(player.id, 'left')}
                            disabled={isPending || isStartingGame}
                            aria-label={`Move ${player.name} up`}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="btn-secondary px-3 py-1.5 text-xl font-black disabled:opacity-50"
                            onClick={() => handleMovePlayer(player.id, 'right')}
                            disabled={isPending || isStartingGame}
                            aria-label={`Move ${player.name} down`}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="btn-danger px-3 py-1.5 text-xl font-black disabled:opacity-50"
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

          <div className="flex justify-end">
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
              <p className="text-sm text-muted">Waiting for game to start...</p>
            )}
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="theme-shell min-h-screen">
      <section className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Setback</h1>
        {requestError && (
          <p className="status-error w-full max-w-md">
            {requestError}
          </p>
        )}
        {sessionInfo && (
          <p className="status-info w-full max-w-md">
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
            className="btn-secondary px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => setIsRejoinModalOpen(true)}
            disabled={isLoadingRejoinGames || rejoinableGames.length === 0}
          >
            Continue Game
          </button>
        </div>
      </section>

      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={closeCreateModal}
        >
          <div
            className="dialog-surface w-full max-w-md p-6 text-left"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-xl font-semibold">Create Game</h2>
            <form className="mt-4 flex flex-col gap-4" onSubmit={handleCreateGame}>
              <label className="flex flex-col gap-2">
                <span className="text-sm text-muted">Player Name</span>
                <input
                  type="text"
                  value={playerName}
                  onChange={(event) => {
                    setPlayerName(event.target.value)
                    setCreateErrors((prev) => ({ ...prev, playerName: undefined }))
                  }}
                  className="input-surface"
                  placeholder="Enter your name"
                />
                {createErrors.playerName && (
                  <span className="text-sm text-red-300">{createErrors.playerName}</span>
                )}
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm text-muted">Max Cards</span>
                <select
                  value={maxCards}
                  onChange={(event) => {
                    setMaxCards(event.target.value)
                    setCreateErrors((prev) => ({ ...prev, maxCards: undefined }))
                  }}
                  className="input-surface"
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
                {createErrors.maxCards && (
                  <span className="text-sm text-red-300">{createErrors.maxCards}</span>
                )}
              </label>

              <div className="mt-2 flex justify-end gap-3">
                  <button
                    type="button"
                  className="btn-secondary px-4 py-2"
                    onClick={closeCreateModal}
                  >
                  Cancel
                </button>
                  <button
                    type="submit"
                    disabled={isCreatingGame}
                  className="btn-primary px-4 py-2"
                  >
                  {isCreatingGame ? 'Creating...' : 'Create Game'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isJoinModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={closeJoinModal}
        >
          <div
            className="dialog-surface w-full max-w-md p-6 text-left"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-xl font-semibold">Join Game</h2>
            <form className="mt-4 flex flex-col gap-4" onSubmit={handleJoinGame}>
              <label className="flex flex-col gap-2">
                <span className="text-sm text-muted">Game ID</span>
                <input
                  type="text"
                  value={joinGameId}
                  onChange={(event) => {
                    setJoinGameId(event.target.value)
                    setJoinErrors((prev) => ({ ...prev, gameId: undefined }))
                  }}
                  className="input-surface"
                  placeholder="Enter game ID"
                />
                {joinErrors.gameId && (
                  <span className="text-sm text-red-300">{joinErrors.gameId}</span>
                )}
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm text-muted">Player Name</span>
                <input
                  type="text"
                  value={joinPlayerName}
                  onChange={(event) => {
                    setJoinPlayerName(event.target.value)
                    setJoinErrors((prev) => ({ ...prev, playerName: undefined }))
                  }}
                  className="input-surface"
                  placeholder="Enter your name"
                />
                {joinErrors.playerName && (
                  <span className="text-sm text-red-300">{joinErrors.playerName}</span>
                )}
              </label>

              <div className="mt-2 flex justify-end gap-3">
                  <button
                    type="button"
                  className="btn-secondary px-4 py-2"
                    onClick={closeJoinModal}
                  >
                  Cancel
                </button>
                  <button
                    type="submit"
                    disabled={isJoiningGame}
                  className="btn-primary px-4 py-2"
                  >
                  {isJoiningGame ? 'Joining...' : 'Join Game'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isRejoinModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={closeRejoinModal}
        >
          <div
            className="dialog-surface w-full max-w-md p-6 text-left"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-xl font-semibold">Rejoin Game</h2>
            <form className="mt-4 flex flex-col gap-4" onSubmit={handleRejoinGame}>
              <label className="flex flex-col gap-2">
                <span className="text-sm text-muted">Stored Game</span>
                <select
                  value={selectedRejoinGameId}
                  onChange={(event) => setSelectedRejoinGameId(event.target.value)}
                  className="input-surface"
                  disabled={isRejoiningGame || rejoinableGames.length === 0}
                >
                  {rejoinableGames.map((game) => (
                    <option key={game.gameId} value={game.gameId}>
                      {game.gameId} ({game.phase})
                    </option>
                  ))}
                </select>
              </label>

              <div className="mt-2 flex justify-end gap-3">
                <button
                  type="button"
                  className="btn-secondary px-4 py-2"
                  onClick={closeRejoinModal}
                  disabled={isRejoiningGame}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRejoiningGame || rejoinableGames.length === 0}
                  className="btn-primary px-4 py-2 disabled:opacity-50"
                >
                  {isRejoiningGame ? 'Rejoining...' : 'Continue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
