import type { AIDifficulty, Card, CardCount, SortMode } from './game'
import type { ReactionEmoji, ReactionPhrase } from './reactions'

export type LambdaAction =
  | 'createGame'
  | 'joinGame'
  | 'checkState'
  | 'addSeat'
  | 'removeSeat'
  | 'startGame'
  | 'startOver'
  | 'dealCards'
  | 'submitBid'
  | 'playCard'
  | 'returnFromAway'
  | 'coverAwayPlayerTurn'
  | 'sortCards'
  | 'movePlayer'
  | 'setPlayerAway'
  | 'removePlayer'
  | 'renamePlayer'
  | 'sendReaction'
  | 'removeGame'
  | 'getGameState'

type PublicAction = 'createGame' | 'joinGame'

type ActionPayloadMap = {
  createGame: {
    playerName: string
    blindBid?: boolean
  }
  joinGame: {
    gameId: string
    playerName: string
  }
  checkState: {
    gameId: string
    associateConnection?: boolean
  }
  addSeat: {
    gameId: string
  }
  removeSeat: {
    gameId: string
    playerId: string
  }
  startGame: {
    gameId: string
    maxCards: CardCount
    dealerPlayerId?: string
    aiDifficulty?: AIDifficulty
  }
  startOver: {
    gameId: string
  }
  dealCards: {
    gameId: string
  }
  submitBid: {
    gameId: string
    bid: number
    trip?: boolean
  }
  playCard: {
    gameId: string
    card: Card
  }
  returnFromAway: {
    gameId: string
  }
  coverAwayPlayerTurn: {
    gameId: string
    playerId: string
  }
  sortCards: {
    gameId: string
    mode: SortMode
  }
  movePlayer: {
    gameId: string
    playerId: string
    direction: string
  }
  setPlayerAway: {
    gameId: string
    playerId: string
  }
  removePlayer: {
    gameId: string
    playerId: string
  }
  renamePlayer: {
    gameId: string
    playerName: string
    playerId?: string
  }
  sendReaction: {
    gameId: string
    emoji?: ReactionEmoji
    phrase?: ReactionPhrase
  }
  removeGame: {
    gameId: string
    playerToken: string
  }
  getGameState: {
    gameId: string
    version: number
    associateConnection?: boolean
  }
}

type LambdaPayloadForAction<TAction extends LambdaAction> =
  TAction extends PublicAction
    ? ActionPayloadMap[TAction]
    : ActionPayloadMap[TAction] & { playerToken: string }

export type LambdaEventPayload<TAction extends LambdaAction = LambdaAction> =
  TAction extends LambdaAction
    ? {
        action: TAction
        payload: LambdaPayloadForAction<TAction>
      }
    : never
