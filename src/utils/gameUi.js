export const REACTION_EMOJIS = ['😀', '😂', '😮', '😢', '😡', '👏', '🔥', '🎉']
export const REACTION_COOLDOWN_MS = 5000
export const AI_ACTION_DELAY_MS = 1500
export const TRICK_COMPLETE_DELAY_MS = 5000
export const RATE_LIMIT_BACKOFF_MS = 5000
const MAX_SUPPORTED_CARD_COUNT = 10

export const getPlayerName = (game, playerId) =>
  game?.players?.find((player) => player.id === playerId)?.name ?? 'Unknown'

export const getMaxCardsForSeatCount = (seatCount) => {
  if (!Number.isInteger(seatCount) || seatCount < 1) {
    return 1
  }

  return Math.min(MAX_SUPPORTED_CARD_COUNT, Math.floor(53 / seatCount))
}

export const getBidDisplay = (bidEntry) => {
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

export const getInvalidPlayMessage = (game, viewerHand, candidateCard) => {
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

export const toUserFacingActionError = (error, fallbackMessage) => {
  const message = error instanceof Error ? error.message : fallbackMessage
  const normalizedMessage = message.toLowerCase()

  if (message.includes('TransactionConflict') || message.includes('Transaction cancelled')) {
    return 'Another move updated the game at the same time. Please try again.'
  }

  if (
    normalizedMessage.includes('rate exceeded') ||
    normalizedMessage.includes('too many requests') ||
    normalizedMessage.includes('throttl')
  ) {
    return 'The service is a little busy right now. Please wait a moment and try again.'
  }

  return message
}

export const hashString = (value) => {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }

  return hash
}

const SUIT_SYMBOLS = {
  Hearts: '♥️',
  Diamonds: '♦️',
  Clubs: '♣️',
  Spades: '♠️',
  Joker: '⭐',
}

export const getCardLabel = (card) => {
  if (!card?.rank || !card?.suit) {
    return 'Unknown card'
  }

  if (card.suit === 'Joker') {
    return card.rank === 'BJ' ? 'Big Joker' : card.rank === 'LJ' ? 'Little Joker' : 'Joker'
  }

  const suitLabel = card.suit.slice(0, -1) === 'Diamond' ? 'Diamonds' : card.suit
  return `${card.rank} of ${suitLabel}`
}

export const getCardDisplay = (card) => {
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

export const getRoundDirectionArrow = (direction) => (direction === 'up' ? '⬆' : '⬇')

export const getCompletedRoundCount = (game) => {
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

export const buildRoundSummary = (game, roundIndex) => {
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

export const getViewerHand = (game) => {
  if (!game?.phase || !('cards' in game.phase)) {
    return null
  }

  return game.phase.cards.hands?.[0] ?? null
}

const RANK_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', 'LJ', 'BJ']
const SUIT_ORDER = ['Clubs', 'Diamonds', 'Hearts', 'Spades']

const getRankValue = (rank) => RANK_ORDER.indexOf(rank)

export const sortHandCards = (cards = [], mode = 'bySuit', trumpSuit) => {
  const normalizedCards = Array.isArray(cards) ? [...cards] : []

  if (mode === 'byRank') {
    return normalizedCards.sort((left, right) => {
      const rankDiff = getRankValue(left.rank) - getRankValue(right.rank)
      if (rankDiff !== 0) {
        return rankDiff
      }

      const leftSuit = left.suit === 'Joker' ? 99 : SUIT_ORDER.indexOf(left.suit)
      const rightSuit = right.suit === 'Joker' ? 99 : SUIT_ORDER.indexOf(right.suit)
      return leftSuit - rightSuit
    })
  }

  return normalizedCards.sort((left, right) => {
    const normalizedSuit = (card) => {
      if (card.suit === 'Joker') {
        return trumpSuit && trumpSuit !== 'Joker' ? SUIT_ORDER.length : SUIT_ORDER.length + 1
      }

      const suitIndex = SUIT_ORDER.indexOf(card.suit)
      if (trumpSuit && trumpSuit !== 'Joker' && card.suit === trumpSuit) {
        return SUIT_ORDER.length
      }

      return suitIndex
    }

    const suitDiff = normalizedSuit(left) - normalizedSuit(right)
    if (suitDiff !== 0) {
      return suitDiff
    }

    if (left.suit === 'Joker' && right.suit !== 'Joker') {
      return 1
    }

    if (left.suit !== 'Joker' && right.suit === 'Joker') {
      return -1
    }

    return getRankValue(left.rank) - getRankValue(right.rank)
  })
}
