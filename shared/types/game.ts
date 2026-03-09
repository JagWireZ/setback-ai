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

export type Bid = {
  playerId: string
  amount: number
  trip: boolean
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

export type PhaseStage = 'Lobby' | 'Dealing' | 'Bidding' | 'Playing' | 'Scoring' | 'GameOver'

export type PhaseCards = {
  deck: Card[]
  trump?: Card
  trumpBroken: boolean
  hands: Hand[]
  currentTrick?: Trick
  completedTricks: Trick[]
}

type RoundPhaseBase = {
  dealerPlayerId: string
  roundIndex: number
  trickIndex: number
  bids: Bid[]
  cards: PhaseCards
}

export type LobbyPhase = {
  stage: 'Lobby'
}

export type DealingPhase = RoundPhaseBase & {
  stage: 'Dealing'
  turnPlayerId: string
}

export type BiddingPhase = RoundPhaseBase & {
  stage: 'Bidding'
  turnPlayerId: string
}

export type PlayingPhase = RoundPhaseBase & {
  stage: 'Playing'
  turnPlayerId: string
}

export type ScoringPhase = RoundPhaseBase & {
  stage: 'Scoring'
}

export type GameOverPhase = {
  stage: 'GameOver'
}

export type Phase =
  | LobbyPhase
  | DealingPhase
  | BiddingPhase
  | PlayingPhase
  | ScoringPhase
  | GameOverPhase

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

export type Game = {
  id: string
  version: number
  ownerToken: string
  options: Options
  players: Player[]
  playerTokens: PlayerToken[]
  playerOrder: string[]
  scores: Score[]
  phase: Phase
}
