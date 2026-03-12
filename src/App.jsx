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

const getPlayerName = (game, playerId) =>
  game?.players?.find((player) => player.id === playerId)?.name ?? 'Unknown'

const getBidDisplay = (bidEntry) => {
  if (bidEntry?.trip === true) {
    return 'Trip'
  }

  if (typeof bidEntry?.amount === 'number') {
    return String(bidEntry.amount)
  }

  return '...'
}

const getNormalizedPlaySuit = (card, trumpSuit) => (card?.suit === 'Joker' ? trumpSuit : card?.suit)

const isTrumpPlayCard = (card, trumpSuit) => getNormalizedPlaySuit(card, trumpSuit) === trumpSuit

const handHasSuit = (cards, suit, trumpSuit) =>
  cards.some((card) => getNormalizedPlaySuit(card, trumpSuit) === suit)

const canLeadTrumpSuit = (cards, trumpSuit, trumpBroken) => {
  if (trumpBroken) {
    return true
  }

  return cards.every((card) => isTrumpPlayCard(card, trumpSuit))
}

const getInvalidPlayMessage = (game, viewerHand, candidateCard) => {
  if (!candidateCard || game?.phase?.stage !== 'Playing' || !viewerHand?.playerId || game.phase.turnPlayerId !== viewerHand.playerId) {
    return ''
  }

  const trumpSuit = game.phase.cards.trump?.suit
  if (!trumpSuit) {
    return ''
  }

  const currentTrick = game.phase.cards.currentTrick
  if (currentTrick?.plays?.some((play) => play.playerId === viewerHand.playerId)) {
    return ''
  }

  const leadCard = currentTrick?.plays?.[0]?.card
  const leadSuit = leadCard ? getNormalizedPlaySuit(leadCard, trumpSuit) : undefined
  const selectedSuit = getNormalizedPlaySuit(candidateCard, trumpSuit)
  const selectedIsTrump = isTrumpPlayCard(candidateCard, trumpSuit)
  const playerHasLeadSuit = leadSuit ? handHasSuit(viewerHand.cards ?? [], leadSuit, trumpSuit) : false

  if (!leadSuit) {
    if (selectedIsTrump && !canLeadTrumpSuit(viewerHand.cards ?? [], trumpSuit, game.phase.cards.trumpBroken)) {
      return `You cannot lead with ${trumpSuit} until trump is broken.`
    }

    return ''
  }

  if (playerHasLeadSuit && selectedSuit !== leadSuit) {
    return `You must follow ${leadSuit}.`
  }

  return ''
}

const toUserFacingActionError = (error, fallbackMessage) => {
  const message = error instanceof Error ? error.message : fallbackMessage

  if (message.includes('TransactionConflict') || message.includes('Transaction cancelled')) {
    return 'Another move updated the game at the same time. Please try again.'
  }

  return message
}

const SUIT_SYMBOLS = {
  Hearts: '♥️',
  Diamonds: '♦️',
  Clubs: '♣️',
  Spades: '♠️',
  Joker: '⭐',
}

const REACTION_EMOJIS = ['😀', '😂', '😮', '😢', '😡', '👏', '🔥', '🎉']

const hashString = (value) => {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }

  return hash
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
  jokerTextClassName = 'text-[32%] font-bold tracking-[0.1em]',
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
        {display.accent ? <span className={`mb-[4%] ${jokerTextClassName}`}>{display.accent}</span> : null}
        {showCenterSymbol ? <span className={centerSymbolClassName}>{display.center}</span> : null}
        {display.accent ? <span className={`mt-[2%] ${jokerTextClassName}`}>JOKER</span> : null}
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
  const currentDealerPlayerId = game?.phase && 'dealerPlayerId' in game.phase ? game.phase.dealerPlayerId : ''

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
        const playerRainbow = score?.rounds?.[currentRoundIndex]?.rainbow === true

        return (
          <li key={player.id} className="rounded border panel-surface-strong px-3 py-2 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{player.name}</p>
                  {player.id === currentDealerPlayerId ? (
                    <span className="rounded-full border border-white/15 bg-white/8 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-dim">
                      Dealer
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-lg font-semibold text-white">
                  {score?.total ?? 0}
                  {playerRainbow ? <span className="ml-2" aria-label="Rainbow round">🌈</span> : null}
                </p>
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

function ScoreHistory({ game, onClose }) {
  const playersById = new Map((game.players ?? []).map((player) => [player.id, player]))
  const orderedPlayers =
    (game.playerOrder ?? [])
      .map((playerId) => playersById.get(playerId))
      .filter(Boolean)
  const displayPlayers = orderedPlayers.length > 0 ? orderedPlayers : game.players ?? []
  const completedRoundCount = getCompletedRoundCount(game)
  const historyRounds = Array.from({ length: completedRoundCount }, (_, roundIndex) => {
    const roundConfig = game.options?.rounds?.[roundIndex]

    return {
      roundIndex,
      cardCount: roundConfig?.cardCount ?? '?',
      direction: roundConfig?.direction ?? 'up',
      players: displayPlayers
        .map((player) => {
          const score = game.scores?.find((entry) => entry.playerId === player.id)
          const round = score?.rounds?.[roundIndex]

          return {
            playerId: player.id,
            name: player.name,
            bid: round?.bid ?? '-',
            books: round?.books ?? 0,
            score: round?.total ?? 0,
            rainbow: round?.rainbow ?? false,
          }
        })
        .sort((left, right) => right.score - left.score),
    }
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        className="dialog-surface w-full max-w-4xl p-6 text-left"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Game History</h2>
          <button
            type="button"
            className="btn-secondary px-3 py-2 text-sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        {historyRounds.length === 0 ? (
          <p className="mt-4 text-sm text-dim">No completed rounds yet.</p>
        ) : (
          <div className="mt-4 max-h-[70vh] overflow-auto pr-1">
            <div className="flex flex-col gap-4">
              {historyRounds.map((round) => {
                const winningScore = round.players[0]?.score ?? null

                return (
                  <section key={round.roundIndex} className="panel-surface rounded-2xl border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold">
                        {`Round ${round.cardCount} ${getRoundDirectionArrow(round.direction)}`}
                      </h3>
                    </div>
                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-dim">
                            <th className="pb-2 pr-4 font-medium">Player</th>
                            <th className="pb-2 pr-4 font-medium">Bid</th>
                            <th className="pb-2 pr-4 font-medium">Books</th>
                            <th className="pb-2 pr-4 font-medium">Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {round.players.map((player) => (
                            <tr
                              key={player.playerId}
                              className={`border-t ${
                                winningScore !== null && player.score === winningScore
                                  ? 'border-[rgba(34,130,88,0.4)] bg-[rgba(22,101,52,0.16)]'
                                  : 'border-white/10'
                              }`}
                            >
                              <td className="py-2 pr-4 font-medium text-white">{player.name}</td>
                              <td className="py-2 pr-4 text-white">{player.bid}</td>
                              <td className="py-2 pr-4 text-white">{player.books}</td>
                              <td className="py-2 pr-4 text-white">{player.score}{player.rainbow ? ' 🌈' : ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
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

const getCompletedRoundCount = (game) => {
  const maxRecordedRounds = Array.isArray(game?.scores)
    ? Math.max(0, ...game.scores.map((score) => score?.rounds?.length ?? 0))
    : 0

  if (!game?.phase || !('roundIndex' in game.phase)) {
    return maxRecordedRounds
  }

  if (game.phase.stage === 'EndOfRound') {
    return Math.min(maxRecordedRounds, game.phase.roundIndex + 1)
  }

  if (game.phase.stage === 'Dealing' || game.phase.stage === 'Bidding' || game.phase.stage === 'Playing' || game.phase.stage === 'Scoring') {
    return Math.min(maxRecordedRounds, game.phase.roundIndex)
  }

  return maxRecordedRounds
}

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
    players: (game.playerOrder ?? [])
      .map((playerId) => {
        const player = game.players?.find((entry) => entry.id === playerId)
        const roundResult = game.scores?.find((score) => score.playerId === playerId)?.rounds?.[roundIndex]

        return {
          playerId,
          name: player?.name ?? 'Unknown',
          bid: roundResult?.bid ?? 0,
          books: roundResult?.books ?? 0,
          score: roundResult?.total ?? 0,
          rainbow: roundResult?.rainbow === true,
        }
      })
      .sort((left, right) => right.score - left.score),
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
  errorMessage,
  shareLink,
  onCopyShareLink,
  onSetGameError,
  onRenamePlayer,
  onDealCards,
  onSubmitBid,
  onPlayCard,
  onSortCards,
  onStartOver,
  onSendReaction,
  onOpenNewGame,
  onOpenJoinGame,
  onOpenSwitchGame,
  isDealingCards,
  isStartingOver,
  isSubmittingBid,
  isPlayingCard,
  isSendingReaction,
  isRenamingPlayer,
  isSortingCards,
  isLoadingRejoinGames,
  hasRejoinableGames,
}) {
  const viewerHand = getViewerHand(game)
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 1024 : window.innerWidth,
  )
  const [mobileActionBarHeight, setMobileActionBarHeight] = useState(0)
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
  const [editedPlayerName, setEditedPlayerName] = useState('')
  const [bookWinnerMessage, setBookWinnerMessage] = useState('')
  const previousCompletedTrickCountRef = useRef(0)
  const bookWinnerTimeoutRef = useRef(null)
  const selectedTrickCardTimeoutRef = useRef(null)
  const mobileActionBarRef = useRef(null)
  const reactionPickerRef = useRef(null)

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
  const currentPlayerName = getPlayerName(game, viewerPlayerId)
  const activeReactions = game?.reactions ?? []
  const reactionLayouts = useMemo(
    () =>
      activeReactions.map((reaction, index) => {
        const hash = hashString(reaction.id)
        const left = 38 + (hash % 25)
        const driftDirection = hash % 2 === 0 ? 1 : -1
        const driftA = driftDirection * (12 + ((hash >> 3) % 8))
        const driftB = driftDirection * -1 * (8 + ((hash >> 6) % 10))
        const driftC = driftDirection * (16 + ((hash >> 9) % 12))
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

  useEffect(() => {
    console.log('[reactions] viewport', {
      isMobileViewport,
      viewportWidth,
      mobileActionBarHeight,
      activeReactionCount: activeReactions.length,
    })
  }, [activeReactions.length, isMobileViewport, mobileActionBarHeight, viewportWidth])

  useEffect(() => {
    if (activeReactions.length === 0) {
      return
    }

    console.log(
      '[reactions] render payload',
      reactionLayouts.map(({ reaction, style }) => ({
        id: reaction.id,
        playerId: reaction.playerId,
        emoji: reaction.emoji,
        style,
      })),
    )
  }, [activeReactions.length, reactionLayouts])
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
    <div className="relative flex flex-wrap items-center justify-center gap-3 px-3 py-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn-secondary min-h-12 border-[#2f6fdb] bg-[#2f6fdb] px-4 py-3 text-sm text-white hover:bg-[#1f58b7]"
          onClick={() => setIsMenuModalOpen(true)}
          aria-label="Open game menu"
        >
          ☰
        </button>
        {isMobileBar ? (
          <button
            type="button"
            className="btn-secondary min-h-12 border-[#2f6fdb] bg-[#2f6fdb] px-4 py-3 text-sm text-white hover:bg-[#1f58b7]"
            onClick={() => setIsScoreModalOpen(true)}
          >
            Score
          </button>
        ) : null}
      </div>
      {canSortCards ? (
        <button
          type="button"
          className="btn-secondary min-h-12 border-[#2f6fdb] bg-[#2f6fdb] px-4 py-3 text-sm text-white hover:bg-[#1f58b7] disabled:opacity-50"
          onClick={onSortCards}
          disabled={isSortingCards}
        >
          {isSortingCards ? 'Sorting...' : 'Sort'}
        </button>
      ) : null}
      {availableActions.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-2">
          {availableActions.map((action) => {
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
                className={`min-h-12 rounded-md border px-4 py-3 text-sm text-white disabled:opacity-50 ${
                  shouldFlashActionButton
                    ? 'animate-pulse border-[#c74343] bg-[#c74343] shadow-[0_0_18px_rgba(199,67,67,0.45)]'
                    : isPrimaryAction
                      ? 'border-[#2f6fdb] bg-[#2f6fdb] text-white shadow-[0_10px_24px_rgba(47,111,219,0.35)] hover:bg-[#1f58b7]'
                      : 'btn-secondary border-[#2f6fdb] bg-[#2f6fdb] text-white hover:bg-[#1f58b7]'
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
          })}
        </div>
      ) : null}
      <div className="relative" ref={isMobileBar === isMobileViewport ? reactionPickerRef : undefined}>
        {isReactionModalOpen && isMobileBar === isMobileViewport ? (
          <div className="absolute bottom-full right-0 z-50 mb-3 w-[13rem] rounded-2xl bg-[#3a3a3a] p-3 shadow-[0_18px_40px_rgba(0,0,0,0.35)] sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
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
                  disabled={isSendingReaction}
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
          disabled={isSendingReaction || typeof onSendReaction !== 'function'}
          aria-label="Open reactions"
        >
          😀
        </button>
      </div>
    </div>
  )

  return (
    <>
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
          <article className="score-scroll hidden min-h-0 max-h-full self-start overflow-auto rounded-2xl border border-white/10 bg-[rgba(35,35,35,0.25)] pb-4 pl-4 pr-1 pt-4 md:block">
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
            <div className="mt-4 flex justify-end pr-3">
              <button
                type="button"
                className="text-sm font-medium text-[#9ed3b4] transition hover:text-[#d9f7e5]"
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
              {isViewerTurn ? (
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
              <section className="mb-3 flex min-h-0 flex-1 flex-col rounded-2xl border border-[rgba(34,130,88,0.34)] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(0,0,0,0.08)),rgba(22,101,52,0.16)] px-3 py-3 sm:px-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d9f7e5]">Bids</h2>
                  <p className="text-xs text-[#9ed3b4]">
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
                            ? 'border-[rgba(34,130,88,0.78)] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(0,0,0,0.08)),rgba(22,101,52,0.24)] shadow-[0_0_18px_rgba(22,101,52,0.22)]'
                            : 'border-white/10 bg-[rgba(255,255,255,0.05)]'
                        }`}
                      >
                        <div className="grid grid-cols-[minmax(0,1fr)_3rem_4.75rem] items-center gap-3">
                          <p className="min-w-0 truncate text-sm font-medium text-white">
                            {player.name}
                            {playerRainbow ? ' 🌈' : ''}
                          </p>
                          <p className={`text-right text-base font-semibold ${hasBid ? 'text-[#d9f7e5]' : 'text-dim'}`}>
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
                <p className="text-center text-lg text-[#d8e6ff]">{bookWinnerMessage}</p>
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
                    No cards played in this trick yet.
                  </li>
                )}
              </ul>
            )}
          </article>
        </div>

        {errorMessage ? (
          <div className="mt-3 flex justify-center">
            <p className="max-w-xl rounded-md bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(0,0,0,0.05)),rgba(199,67,67,0.08)] px-3 py-2 text-center text-sm text-[#f1c5c5]">
              {errorMessage}
            </p>
          </div>
        ) : null}
        <article
          className={`mt-3 shrink-0 overflow-hidden rounded-3xl border p-1 sm:overflow-x-auto ${
            canSelectCards
              ? 'hand-active'
              : 'border-white/10'
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
              <p className="text-sm text-dim">No cards in hand yet.</p>
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
            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                className="text-sm font-medium text-[#9ed3b4] transition hover:text-[#d9f7e5]"
                onClick={() => setIsHistoryModalOpen(true)}
              >
                See History
              </button>
              <button
                type="button"
                className="btn-secondary px-4 py-2"
                onClick={() => setIsScoreModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {isHistoryModalOpen ? (
        <ScoreHistory
          game={game}
          onClose={() => setIsHistoryModalOpen(false)}
        />
      ) : null}
      {isMenuModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => setIsMenuModalOpen(false)}
        >
          <div
            className="dialog-surface w-full max-w-sm p-6 text-left"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <button
                  type="button"
                  className="min-w-0 truncate text-left text-xl font-semibold text-white transition hover:text-[#d9f7e5]"
                  onClick={() => {
                    setIsEditingPlayerName(true)
                    setEditedPlayerName(currentPlayerName)
                  }}
                >
                  {`👤 ${currentPlayerName}`}
                </button>
              </div>
            </div>
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
                  setIsMenuModalOpen(false)
                  onOpenJoinGame?.()
                }}
              >
                Join Game
              </button>
              <button
                type="button"
                className="btn-secondary w-[90%] px-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  setIsMenuModalOpen(false)
                  onOpenSwitchGame?.()
                }}
                disabled={isLoadingRejoinGames || !hasRejoinableGames}
              >
                Switch Game
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
              ) : null}
            </div>
            <section className="mt-5 border-t border-white/10 pt-5">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <span className="text-sm">🔗</span>
                <span>Share Link</span>
              </h3>
              <div className="mt-3 flex flex-col items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareLink}
                  className="input-surface w-[90%] text-sm"
                />
                <button
                  type="button"
                  className="btn-primary w-[90%] px-4 py-2 text-sm"
                  onClick={onCopyShareLink}
                >
                  Copy Link
                </button>
              </div>
            </section>
          </div>
        </div>
      )}
      {isResetConfirmModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={() => setIsResetConfirmModalOpen(false)}
        >
          <div
            className="dialog-surface w-full max-w-md p-6 text-left"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-xl font-semibold text-white">Reset Game?</h2>
            <p className="mt-3 text-sm text-muted">
              This will erase the current game progress, send everyone back to the lobby, and restart from round 1.
            </p>
            <p className="mt-2 text-sm text-[#f1c5c5]">
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
                className="btn-danger bg-[rgba(199,67,67,0.12)] px-4 py-2"
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
    </>
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
  const [gameError, setGameError] = useState('')
  const [lobbyInfo, setLobbyInfo] = useState('')
  const [isStartingGame, setIsStartingGame] = useState(false)
  const [isDealingCards, setIsDealingCards] = useState(false)
  const [isBidModalOpen, setIsBidModalOpen] = useState(false)
  const [isSortModalOpen, setIsSortModalOpen] = useState(false)
  const [selectedBid, setSelectedBid] = useState('0')
  const [isSubmittingBid, setIsSubmittingBid] = useState(false)
  const [isPlayingCard, setIsPlayingCard] = useState(false)
  const [isSendingReaction, setIsSendingReaction] = useState(false)
  const [isRenamingPlayer, setIsRenamingPlayer] = useState(false)
  const [isSortingCards, setIsSortingCards] = useState(false)
  const [isStartingOver, setIsStartingOver] = useState(false)
  const [isEndOfRoundModalDismissed, setIsEndOfRoundModalDismissed] = useState(false)
  const [persistedEndOfRoundSummary, setPersistedEndOfRoundSummary] = useState(null)
  const [pendingPlayerActionId, setPendingPlayerActionId] = useState('')
  const [selectedDealerPlayerId, setSelectedDealerPlayerId] = useState('')
  const aiPauseUntilRef = useRef(0)
  const aiPauseTimeoutRef = useRef(null)
  const previousCompletedTrickCountRef = useRef(0)
  const latestShownRoundIndexRef = useRef(-1)
  const hydratedRoundSummaryGameIdRef = useRef('')
  const gameErrorTimeoutRef = useRef(null)
  const isMutationInFlight =
    isStartingGame || isDealingCards || isSubmittingBid || isPlayingCard || isSendingReaction || isSortingCards || isStartingOver

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
      setGameError('')
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
      setGameError('')
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
      setGameError('')
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
    setIsEndOfRoundModalDismissed(false)
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
      setLobbyInfo('Share link copied.')
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
      return
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to remove player'
      setGameError(message)
    } finally {
      setPendingPlayerActionId('')
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
      setGameError(message)
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
    latestShownRoundIndexRef.current = -1
    hydratedRoundSummaryGameIdRef.current = ''
    if (gameErrorTimeoutRef.current) {
      clearTimeout(gameErrorTimeoutRef.current)
      gameErrorTimeoutRef.current = null
    }
    setOwnerSession(null)
    setPlayerSession(null)
    setGameError('')
    setLobbyInfo('')
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
      setSelectedDealerPlayerId(ownerSession.ownerPlayerId ?? '')
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

  const handleOpenSwitchGame = () => {
    setRequestError('')
    setSessionInfo(null)
    setIsCreateModalOpen(false)
    setIsJoinModalOpen(false)
    setIsRejoinModalOpen(true)
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

      closeSortCardsModal()
    } catch (error) {
      const message = toUserFacingActionError(error, 'Unable to sort cards')
      setGameError(message)
    } finally {
      setIsSortingCards(false)
    }
  }

  const handleSendReaction = async (emoji) => {
    const activeSession = ownerSession ?? playerSession
    if (!activeSession?.gameId || !activeSession?.playerToken) {
      return
    }

    setGameError('')
    setIsSendingReaction(true)

    console.log('[reactions] send start', {
      emoji,
      gameId: activeSession.gameId,
      hasOwnerSession: Boolean(ownerSession),
      hasPlayerSession: Boolean(playerSession),
    })

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

      console.log('[reactions] send success', {
        emoji,
        returnedReactionCount: result?.game?.reactions?.length ?? 0,
        reactions: result?.game?.reactions ?? [],
      })
    } catch (error) {
      const message = toUserFacingActionError(error, 'Unable to send reaction')
      console.log('[reactions] send error', {
        emoji,
        message,
        error,
      })
      setGameError(message)
      throw error
    } finally {
      setIsSendingReaction(false)
    }
  }

  const handleRenamePlayer = async (playerName) => {
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

  const currentDealerPlayerId = ownerSession?.game?.phase?.dealerPlayerId ?? selectedDealerPlayerId

  if (activeGame && activeGame.phase?.stage !== 'Lobby') {
    return (
      <>
        <GameTablePage
          game={activeGame}
          isOwner={Boolean(ownerSession)}
          errorMessage={gameError}
          shareLink={shareLink}
          onCopyShareLink={handleCopyShareLink}
          onSetGameError={setGameError}
          onRenamePlayer={handleRenamePlayer}
          onDealCards={handleDealCards}
          onSubmitBid={openSubmitBidModal}
          onPlayCard={handlePlayCard}
          onSortCards={openSortCardsModal}
          onStartOver={handleStartOver}
          onSendReaction={handleSendReaction}
          onOpenNewGame={handleOpenNewGame}
          onOpenJoinGame={handleOpenJoinGame}
          onOpenSwitchGame={handleOpenSwitchGame}
          isDealingCards={isDealingCards}
          isStartingOver={isStartingOver}
          isSubmittingBid={isSubmittingBid}
          isPlayingCard={isPlayingCard}
          isSendingReaction={isSendingReaction}
          isRenamingPlayer={isRenamingPlayer}
          isSortingCards={isSortingCards}
          isLoadingRejoinGames={isLoadingRejoinGames}
          hasRejoinableGames={rejoinableGames.length > 0}
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
        {persistedEndOfRoundSummary && !isEndOfRoundModalDismissed && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          >
            <div
              className="dialog-surface w-full max-w-lg p-6 text-left"
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
                          ? 'border-[rgba(34,130,88,0.4)] bg-[rgba(22,101,52,0.16)]'
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
      </>
    )
  }

  if (activeLobbySession?.gameId && activeLobbySession?.game) {
    return (
      <main className="theme-shell min-h-screen px-4 py-4 sm:py-6">
        <section className="mx-auto flex w-full max-w-5xl flex-col">
          <div className="table-surface rounded-[2rem] border px-4 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)] sm:px-6 sm:py-6">
            <header className="flex flex-col gap-2 border-b border-white/10 pb-5">
              <h1 className="text-3xl font-bold tracking-tight">
                {isOwnerLobby ? 'Game Owner Lobby' : 'Game Lobby'}
              </h1>
              <div className="flex flex-wrap gap-3 text-sm">
                <p className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-muted">
                  Game ID: {activeLobbySession.gameId}
                </p>
                <p className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-muted">
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

              <section className="panel-surface rounded-2xl border bg-[rgba(45,45,45,0.85)] p-4">
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

              <section className="panel-surface rounded-2xl border bg-[rgba(45,45,45,0.85)] p-4">
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
                        className={`panel-surface-strong rounded-xl border bg-[rgba(52,52,52,0.85)] px-3 py-3 ${
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
                                className="btn-secondary border-white/15 bg-white/8 px-3 py-1.5 text-xl font-black disabled:opacity-50"
                                onClick={() => handleMovePlayer(player.id, 'left')}
                                disabled={isPending || isStartingGame}
                                aria-label={`Move ${player.name} up`}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                className="btn-secondary border-white/15 bg-white/8 px-3 py-1.5 text-xl font-black disabled:opacity-50"
                                onClick={() => handleMovePlayer(player.id, 'right')}
                                disabled={isPending || isStartingGame}
                                aria-label={`Move ${player.name} down`}
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                className="btn-danger bg-[rgba(199,67,67,0.12)] px-3 py-1.5 text-xl font-black disabled:opacity-50"
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
                  <p className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-sm text-muted">
                    Waiting for game to start...
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="theme-shell h-[100dvh] overflow-hidden px-4 py-4">
      <section className="mx-auto flex h-full max-w-xl flex-col items-center justify-center px-2 py-4 text-center sm:py-6">
        <div className="table-surface flex max-h-full w-full flex-col items-center justify-center overflow-hidden rounded-[2rem] border px-6 py-8 sm:py-10 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
        <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">Setback</h1>
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
