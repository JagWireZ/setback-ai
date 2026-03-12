import type { Card, CardCount, ReactionEmoji, SortMode } from './game'

export type LambdaAction =
  | 'createGame'
  | 'joinGame'
  | 'checkState'
  | 'startGame'
  | 'startOver'
  | 'dealCards'
  | 'submitBid'
  | 'playCard'
  | 'sortCards'
  | 'movePlayer'
  | 'removePlayer'
  | 'renamePlayer'
  | 'sendReaction'
  | 'removeGame'
  | 'getGameState'

type PublicAction = 'createGame' | 'joinGame'

type ActionPayloadMap = {
  createGame: {
    playerName: string
    maxCards: CardCount
    blindBid?: boolean
  }
  joinGame: {
    gameId: string
    playerName: string
  }
  checkState: {
    gameId: string
  }
  startGame: {
    gameId: string
    dealerPlayerId?: string
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
  sortCards: {
    gameId: string
    mode: SortMode
  }
  movePlayer: {
    gameId: string
    playerId: string
    direction: string
  }
  removePlayer: {
    gameId: string
    playerId: string
  }
  renamePlayer: {
    gameId: string
    playerName: string
  }
  sendReaction: {
    gameId: string
    emoji: ReactionEmoji
  }
  removeGame: {
    gameId: string
  }
  getGameState: {
    gameId: string
    version: number
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
