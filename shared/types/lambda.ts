import type { Card, CardCount } from './game'

export type LambdaAction =
  | 'createGame'
  | 'joinGame'
  | 'startGame'
  | 'dealCards'
  | 'submitBid'
  | 'playCard'
  | 'movePlayer'
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
  startGame: {
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
  movePlayer: {
    gameId: string
    playerId: string
    direction: string
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
