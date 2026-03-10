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

function CardAsset({ card, className = '', showCornerSuit = true }) {
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
        <span className="text-[152%] leading-none">{display.center}</span>
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
  return (
    <ul className="mt-3 flex flex-col gap-2">
      {(game.players ?? []).map((player) => {
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
          <li key={player.id} className="rounded border border-slate-700 px-3 py-2 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{player.name}</p>
                <p className="mt-1 text-lg font-semibold text-slate-100">{score?.total ?? 0}</p>
              </div>
              <div className="flex flex-col items-end gap-1 text-xs text-slate-300">
                <p>
                  <span className="uppercase tracking-wide text-slate-400">Bid</span>{' '}
                  <span className="ml-3 text-sm text-slate-100">{playerBid}</span>
                </p>
                <p>
                  <span className="uppercase tracking-wide text-slate-400">Books</span>{' '}
                  <span className="ml-3 text-sm text-slate-100">{playerBooks}</span>
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
  const viewerPlayerId = viewerHand?.playerId
  const currentTurnPlayerId = game?.phase && 'turnPlayerId' in game.phase ? game.phase.turnPlayerId : undefined
  const currentRound = game?.phase && 'roundIndex' in game.phase ? game.phase.roundIndex + 1 : 1
  const totalRounds = game?.options?.rounds?.length ?? 0
  const currentRoundIndex = game?.phase && 'roundIndex' in game.phase ? game.phase.roundIndex : 0
  const currentRoundConfig = game?.options?.rounds?.[currentRoundIndex]
  const bids = game?.phase && 'bids' in game.phase ? game.phase.bids : []
  const currentTrick = game?.phase && 'cards' in game.phase ? game.phase.cards.currentTrick : undefined
  const trumpCard = game?.phase && 'cards' in game.phase ? game.phase.cards.trump : undefined
  const booksByPlayerId = useMemo(() => {
    const books = new Map()
    const completedTricks = game?.phase && 'cards' in game.phase ? game.phase.cards.completedTricks ?? [] : []

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

  const isViewerTurn = Boolean(viewerPlayerId && currentTurnPlayerId && viewerPlayerId === currentTurnPlayerId)
  const canSelectCards = game.phase?.stage === 'Playing' && isViewerTurn
  const selectedCard =
    selectedCardIndex !== null && viewerHand?.cards?.[selectedCardIndex]
      ? viewerHand.cards[selectedCardIndex]
      : null

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
    const trickPlays = currentTrick?.plays ?? []

    if (!trickPlays[selectedTrickCardIndex ?? -1]) {
      setSelectedTrickCardIndex(null)
    }
  }, [currentTrick?.plays, selectedTrickCardIndex])

  useEffect(() => {
    const completedTricks = game?.phase && 'cards' in game.phase ? game.phase.cards.completedTricks ?? [] : []
    const latestTrick = completedTricks[completedTricks.length - 1]

    if (completedTricks.length > previousCompletedTrickCountRef.current && latestTrick?.winnerPlayerId) {
      setBookWinnerMessage(`${getPlayerName(game, latestTrick.winnerPlayerId)} won the book!`)
    }

    previousCompletedTrickCountRef.current = completedTricks.length
  }, [game?.version])

  useEffect(() => {
    if ((currentTrick?.plays ?? []).length > 0 || game.phase?.stage !== 'Playing') {
      setBookWinnerMessage('')
    }
  }, [currentTrick?.plays, game.phase?.stage])

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
        return isOwner ? ['Start Over', 'New Game', 'Join Game'] : ['Game is over']
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
    <main className="h-screen overflow-hidden bg-slate-950 px-3 py-3 text-slate-100">
      <section className="mx-auto flex h-full w-full max-w-6xl flex-col gap-3 pb-24">
        <article className="shrink-0 rounded-lg border border-slate-700 bg-slate-900/60 p-4">
          <div className="flex items-start justify-between gap-4 text-sm text-slate-200">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p>
                {currentRoundConfig ? `${currentRoundConfig.cardCount} ${String(currentRoundConfig.direction).toUpperCase()}` : 'N/A'} | {game.phase?.stage ?? 'N/A'}
              </p>
              <p className="truncate">
                {currentTurnPlayerId ? `${getPlayerName(game, currentTurnPlayerId)}'s Turn` : "N/A's Turn"}
              </p>
            </div>
            {trumpCard ? (
              <div className="flex shrink-0 items-center gap-2 self-start">
                <p className="text-sm text-slate-300">Trump</p>
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

        <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[30%_1fr]">
          <article className="hidden min-h-0 overflow-auto rounded-lg border border-slate-700 bg-slate-900/60 p-4 md:block">
            <h2 className="text-lg font-semibold">Score</h2>
            <ScoreSummary
              game={game}
              bids={bids}
              booksByPlayerId={booksByPlayerId}
              currentRoundIndex={currentRoundIndex}
            />
          </article>

          <article className="flex min-h-0 rounded-lg border border-slate-700 bg-slate-900/60 p-4">
            <ul className="flex min-h-[152px] flex-1 items-center justify-center gap-4 overflow-x-auto -translate-y-2">
              {bookWinnerMessage ? (
                <li className="self-center text-center text-lg text-emerald-200">{bookWinnerMessage}</li>
              ) : (currentTrick?.plays ?? []).length > 0 ? (
                currentTrick.plays.map((play, index) => (
                  <li
                    key={`${play.playerId}-${index}`}
                    className="flex w-fit shrink-0 flex-col items-center text-sm"
                    style={{ marginLeft: index === 0 ? '0' : '-3.25rem', zIndex: selectedTrickCardIndex === index ? 100 : index + 1 }}
                  >
                    <div className="mb-3 flex h-5 items-end justify-center">
                      {selectedTrickCardIndex === index ? (
                        <p className="text-center text-lg text-slate-200">{getPlayerName(game, play.playerId)}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className={`relative shrink-0 overflow-visible rounded-lg bg-transparent p-0 transition-transform duration-150 ${
                        selectedTrickCardIndex === index ? '-translate-y-2' : 'translate-y-0'
                      }`}
                      onClick={() =>
                        setSelectedTrickCardIndex((currentIndex) => (currentIndex === index ? null : index))
                      }
                      aria-label={getPlayerName(game, play.playerId)}
                    >
                      <div className="aspect-[2.5/3.5] w-24 sm:w-28">
                        <CardAsset card={play.card} />
                      </div>
                    </button>
                  </li>
                ))
              ) : (
                <li className="self-center text-sm text-slate-400">No cards played in this trick yet.</li>
              )}
            </ul>
          </article>
        </div>

        <article className="shrink-0 overflow-x-auto rounded-lg border border-slate-700 bg-slate-900/60 p-4">
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
                    marginLeft: index === 0 ? '0' : '-3.75rem',
                    zIndex: selectedCardIndex === index ? 100 : index + 1,
                  }}
                  aria-label={getCardLabel(card)}
                >
                  <div className="aspect-[2.5/3.5] w-20 sm:w-24">
                    <CardAsset card={card} />
                  </div>
                </button>
              ))
            ) : (
              <p className="text-sm text-slate-400">No cards in hand yet.</p>
            )}
          </div>
        </article>
      </section>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-700 bg-slate-950/95 px-3 py-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-center gap-3">
          <button
            type="button"
            className="min-h-12 rounded-md border border-slate-500 px-4 py-3 text-sm text-slate-100 md:hidden"
            onClick={() => setIsScoreModalOpen(true)}
          >
            Score
          </button>
          {canSortCards ? (
            <button
              type="button"
              className="min-h-12 rounded-md border border-slate-500 px-4 py-3 text-sm text-slate-100 disabled:opacity-50"
              onClick={onSortCards}
              disabled={isSortingCards}
            >
              {isSortingCards ? 'Sorting...' : 'Sort'}
            </button>
          ) : null}
          <div className="flex flex-wrap justify-center gap-2">
            {availableActions.length > 0 ? (
              availableActions.map((action) => (
                <button
                  key={action}
                  type="button"
                  className="min-h-12 rounded-md border border-slate-500 px-4 py-3 text-sm text-slate-100 disabled:opacity-50"
                  disabled={
                    !isActionEnabled(action) ||
                    isDealingCards ||
                    isSubmittingBid ||
                    isPlayingCard ||
                    isSortingCards ||
                    isStartingOver
                  }
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
              ))
            ) : (
              <button
                type="button"
                className="min-h-12 rounded-md border border-slate-500 px-4 py-3 text-sm text-slate-100"
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
            className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-center text-lg font-semibold text-slate-100">Score</h2>
            <ScoreSummary
              game={game}
              bids={bids}
              booksByPlayerId={booksByPlayerId}
              currentRoundIndex={currentRoundIndex}
            />
          </div>
        </div>
      )}
    </main>
  )
}

export default function App() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false)
  const [playerName, setPlayerName] = useState('')
  const [maxCards, setMaxCards] = useState('10')
  const [joinGameId, setJoinGameId] = useState('')
  const [joinPlayerName, setJoinPlayerName] = useState('')
  const [createErrors, setCreateErrors] = useState({})
  const [joinErrors, setJoinErrors] = useState({})
  const [isCreatingGame, setIsCreatingGame] = useState(false)
  const [isJoiningGame, setIsJoiningGame] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [sessionInfo, setSessionInfo] = useState(null)

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

      try {
        const ownerResult = await checkState({
          gameId: gameIdFromUrl,
          playerToken: storedSession.playerToken,
        })

        if (isCancelled) {
          return
        }

        if (ownerResult?.game) {
          const ownerPlayerId = ownerResult.game.players?.find((player) => player.type === 'human')?.id ?? ''
          setOwnerSession({
            gameId: gameIdFromUrl,
            playerToken: storedSession.playerToken,
            game: ownerResult.game,
            ownerPlayerId,
          })
          setSelectedDealerPlayerId(ownerPlayerId)
          setPlayerSession(null)
          setIsJoinModalOpen(false)
          saveStoredGameSession(gameIdFromUrl, storedSession.playerToken, 'owner')
          return
        }
      } catch {
        // Fallback to standard player validation below.
      }

      try {
        const playerResult = await getGameState({
          gameId: gameIdFromUrl,
          playerToken: storedSession.playerToken,
          version: 0,
        })

        if (isCancelled) {
          return
        }

        if (playerResult?.game || typeof playerResult?.version === 'number') {
          setPlayerSession({
            gameId: gameIdFromUrl,
            playerToken: storedSession.playerToken,
            game: playerResult?.game,
            version: playerResult?.version ?? playerResult?.game?.version ?? 0,
          })
          setOwnerSession(null)
          setIsJoinModalOpen(false)
          saveStoredGameSession(gameIdFromUrl, storedSession.playerToken, 'player')
          return
        }
      } catch {
        // Invalid or expired token; clear and continue with manual join.
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
    }, 5000)

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
    }, 5000)

    return () => clearInterval(interval)
  }, [playerSession?.gameId, playerSession?.playerToken, playerSession?.version])

  const activeLobbySession = ownerSession ?? playerSession
  const isOwnerLobby = Boolean(ownerSession)
  const activeGame = activeLobbySession?.game
  const activeRoundIndex =
    activeGame?.phase && 'roundIndex' in activeGame.phase ? activeGame.phase.roundIndex : 0
  const currentRoundCardCount = activeGame?.options?.rounds?.[activeRoundIndex]?.cardCount ?? 0
  const isTripRound = [1, 2, 3].includes(currentRoundCardCount)

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

    const nextTurnPlayerId =
      activeGame.phase && 'turnPlayerId' in activeGame.phase ? activeGame.phase.turnPlayerId : undefined
    const nextTurnPlayer = activeGame.players?.find((player) => player.id === nextTurnPlayerId)
    const trickJustEnded =
      activeGame.phase &&
      'cards' in activeGame.phase &&
      activeGame.phase.stage === 'Playing' &&
      activeGame.phase.cards.currentTrick === undefined

    if (!trickJustEnded || nextTurnPlayer?.type !== 'ai') {
      aiPauseUntilRef.current = 0
      return
    }

    aiPauseUntilRef.current = Date.now() + 5000
    if (aiPauseTimeoutRef.current) {
      clearTimeout(aiPauseTimeoutRef.current)
    }
    aiPauseTimeoutRef.current = setTimeout(() => {
      aiPauseUntilRef.current = 0
      aiPauseTimeoutRef.current = null
      refreshOwnerGame()
    }, 5000)
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
              className="w-full max-w-md rounded-lg bg-slate-900 p-6 text-left shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 className="text-xl font-semibold">Submit Bid</h2>
              <form className="mt-4 flex flex-col gap-4" onSubmit={handleSubmitBid}>
                <label className="flex flex-col gap-2">
                  <span className="text-sm text-slate-300">Bid Amount</span>
                  <select
                    value={selectedBid}
                    onChange={(event) => setSelectedBid(event.target.value)}
                    className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-0 focus:border-slate-400"
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
                    className="rounded-md border border-slate-500 px-4 py-2 font-medium text-slate-100 transition hover:bg-slate-800"
                    onClick={closeSubmitBidModal}
                    disabled={isSubmittingBid}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-md bg-slate-100 px-4 py-2 font-medium text-slate-900 transition hover:bg-slate-200 disabled:opacity-50"
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
              className="w-full max-w-sm rounded-lg bg-slate-900 p-6 text-left shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 className="text-xl font-semibold">Sort Cards</h2>
              <div className="mt-4 flex flex-col gap-3">
                <button
                  type="button"
                  className="rounded-md border border-slate-500 px-4 py-3 text-left text-slate-100 hover:bg-slate-800 disabled:opacity-50"
                  onClick={() => handleSortCards('bySuit')}
                  disabled={isSortingCards}
                >
                  Sort by Suit
                </button>
                <button
                  type="button"
                  className="rounded-md border border-slate-500 px-4 py-3 text-left text-slate-100 hover:bg-slate-800 disabled:opacity-50"
                  onClick={() => handleSortCards('byRank')}
                  disabled={isSortingCards}
                >
                  Sort by Rank
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
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
        <section className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          <header className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight">
              {isOwnerLobby ? 'Game Owner Lobby' : 'Game Lobby'}
            </h1>
            <p className="text-slate-300">Game ID: {activeLobbySession.gameId}</p>
            <p className="text-slate-300">Phase: {activeLobbySession.game.phase?.stage}</p>
          </header>

          {lobbyError && (
            <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {lobbyError}
            </p>
          )}
          {lobbyInfo && (
            <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {lobbyInfo}
            </p>
          )}

          <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
            <h2 className="text-lg font-semibold">Share Link</h2>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                readOnly
                value={shareLink}
                className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              />
              <button
                type="button"
                className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-200"
                onClick={handleCopyShareLink}
              >
                Copy Link
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">Players</h2>
              {isOwnerLobby && (
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <span>Dealer</span>
                  <select
                    value={selectedDealerPlayerId}
                    onChange={(event) => setSelectedDealerPlayerId(event.target.value)}
                    disabled={isStartingGame || ownerSession.game.phase?.stage !== 'Lobby'}
                    className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 disabled:opacity-50"
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
                    className={`rounded-md border border-slate-700 bg-slate-900 px-3 py-3 ${
                      isOwnerLobby
                        ? 'grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center'
                        : 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{player.name}</span>
                      <span className="rounded border border-slate-500 px-2 py-0.5 text-xs uppercase tracking-wide text-slate-300">
                        {player.type}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {isOwnerLobby && (
                        <>
                          <button
                            type="button"
                            className="rounded-md border border-slate-500 px-3 py-1.5 text-xl font-black hover:bg-slate-800 disabled:opacity-50"
                            onClick={() => handleMovePlayer(player.id, 'left')}
                            disabled={isPending || isStartingGame}
                            aria-label={`Move ${player.name} up`}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-slate-500 px-3 py-1.5 text-xl font-black hover:bg-slate-800 disabled:opacity-50"
                            onClick={() => handleMovePlayer(player.id, 'right')}
                            disabled={isPending || isStartingGame}
                            aria-label={`Move ${player.name} down`}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-red-500/50 px-3 py-1.5 text-xl font-black text-red-200 hover:bg-red-900/30 disabled:opacity-50"
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
                className="rounded-md bg-slate-100 px-4 py-2 font-medium text-slate-900 hover:bg-slate-200 disabled:opacity-50"
                onClick={handleStartGame}
                disabled={isStartingGame || ownerSession.game.phase?.stage !== 'Lobby'}
              >
                {isStartingGame ? 'Starting...' : 'Start Game'}
              </button>
            ) : (
              <p className="text-sm text-slate-300">Waiting for game to start...</p>
            )}
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Setback</h1>
        {requestError && (
          <p className="w-full max-w-md rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {requestError}
          </p>
        )}
        {sessionInfo && (
          <p className="w-full max-w-md rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            {sessionInfo.action === 'createGame' ? 'Game created' : 'Joined game'}: {sessionInfo.gameId}
          </p>
        )}
        <div className="flex w-full max-w-xs flex-col gap-3">
          <button
            type="button"
            className="rounded-md bg-slate-100 px-4 py-2 font-medium text-slate-900 transition hover:bg-slate-200"
            onClick={() => setIsCreateModalOpen(true)}
          >
            New Game
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-500 px-4 py-2 font-medium text-slate-100 transition hover:bg-slate-800"
            onClick={() => setIsJoinModalOpen(true)}
          >
            Join Game
          </button>
        </div>
      </section>

      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={closeCreateModal}
        >
          <div
            className="w-full max-w-md rounded-lg bg-slate-900 p-6 text-left shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-xl font-semibold">Create Game</h2>
            <form className="mt-4 flex flex-col gap-4" onSubmit={handleCreateGame}>
              <label className="flex flex-col gap-2">
                <span className="text-sm text-slate-300">Player Name</span>
                <input
                  type="text"
                  value={playerName}
                  onChange={(event) => {
                    setPlayerName(event.target.value)
                    setCreateErrors((prev) => ({ ...prev, playerName: undefined }))
                  }}
                  className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-0 placeholder:text-slate-400 focus:border-slate-400"
                  placeholder="Enter your name"
                />
                {createErrors.playerName && (
                  <span className="text-sm text-red-300">{createErrors.playerName}</span>
                )}
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm text-slate-300">Max Cards</span>
                <select
                  value={maxCards}
                  onChange={(event) => {
                    setMaxCards(event.target.value)
                    setCreateErrors((prev) => ({ ...prev, maxCards: undefined }))
                  }}
                  className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-0 focus:border-slate-400"
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
                  className="rounded-md border border-slate-500 px-4 py-2 font-medium text-slate-100 transition hover:bg-slate-800"
                  onClick={closeCreateModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingGame}
                  className="rounded-md bg-slate-100 px-4 py-2 font-medium text-slate-900 transition hover:bg-slate-200"
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
            className="w-full max-w-md rounded-lg bg-slate-900 p-6 text-left shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-xl font-semibold">Join Game</h2>
            <form className="mt-4 flex flex-col gap-4" onSubmit={handleJoinGame}>
              <label className="flex flex-col gap-2">
                <span className="text-sm text-slate-300">Game ID</span>
                <input
                  type="text"
                  value={joinGameId}
                  onChange={(event) => {
                    setJoinGameId(event.target.value)
                    setJoinErrors((prev) => ({ ...prev, gameId: undefined }))
                  }}
                  className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-0 placeholder:text-slate-400 focus:border-slate-400"
                  placeholder="Enter game ID"
                />
                {joinErrors.gameId && (
                  <span className="text-sm text-red-300">{joinErrors.gameId}</span>
                )}
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm text-slate-300">Player Name</span>
                <input
                  type="text"
                  value={joinPlayerName}
                  onChange={(event) => {
                    setJoinPlayerName(event.target.value)
                    setJoinErrors((prev) => ({ ...prev, playerName: undefined }))
                  }}
                  className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-0 placeholder:text-slate-400 focus:border-slate-400"
                  placeholder="Enter your name"
                />
                {joinErrors.playerName && (
                  <span className="text-sm text-red-300">{joinErrors.playerName}</span>
                )}
              </label>

              <div className="mt-2 flex justify-end gap-3">
                <button
                  type="button"
                  className="rounded-md border border-slate-500 px-4 py-2 font-medium text-slate-100 transition hover:bg-slate-800"
                  onClick={closeJoinModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isJoiningGame}
                  className="rounded-md bg-slate-100 px-4 py-2 font-medium text-slate-900 transition hover:bg-slate-200"
                >
                  {isJoiningGame ? 'Joining...' : 'Join Game'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
