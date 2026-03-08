// Card types
export type Suit = 'Clubs' | 'Diamonds' | 'Hearts' | 'Spades' | 'Joker'

export type Rank =
  | 'A'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'
  | 'LJ'
  | 'BJ'

export type Card = {
  rank: Rank
  suit: Suit
}

export type Hand = {
  playerId: string
  cards: Card[]
}

// Round types
export type CardCount = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
export type RoundDirection = 'up' | 'down'

export type Round = {
  cardCount: CardCount
  direction: RoundDirection
}

export type GamePhase = 'Lobby' | 'Playing' | 'GameOver'

export type RoundPhase = 'Dealing' | 'Bidding' | 'Playing'

export type Bid = {
  playerId: string
  amount: number
}

export type TrickPlay = {
  playerId: string
  card: Card
}

export type Trick = {
  index: number
  leadPlayerId: string
  plays: TrickPlay[]
  winnerPlayerId?: string
}

export type ActiveRound = Round & {
  phase: RoundPhase
  turnPlayerId: string
  dealerPlayerId: string
  trickIndex: number
  bids: Bid[]
  cards: {
    deck: Card[]
    trump: Card
    hands: Hand[]
    currentTrick?: Trick
    completedTricks: Trick[]
  }
}

// Player types
export type PlayerType = 'ai' | 'human'

export type Player = {
  id: string
  name: string
  type: PlayerType
  connected: boolean
}

export type PlayerToken = {
  playerId: string
  token: string
}

export type Options = {
  maxCards: CardCount
  blindBid: boolean
  rounds: Round[]
}

export type Score = {
  playerId: string
  total: number
  possible: number
}

type GameBase = {
  id: string
  version: number
  ownerToken: string
  options: Options
  players: Player[]
  playerTokens: PlayerToken[]
  playerOrder: string[]
  scores: Score[]
}

export type LobbyGame = GameBase & {
  phase: 'Lobby'
  activeRound?: never
}

export type PlayingGame = GameBase & {
  phase: 'Playing'
  activeRound: ActiveRound
}

export type GameOverGame = GameBase & {
  phase: 'GameOver'
  activeRound?: never
}

// Game types
export type Game = LobbyGame | PlayingGame | GameOverGame
