import type { Card, CardCount } from './game'

export type LambdaAction =
  | 'createGame'
  | 'joinGame'
  | 'setOptions'
  | 'startGame'
  | 'dealCards'
  | 'submitBid'
  | 'playCard'
  | 'movePlayer'
  | 'removePlayer'
  | 'reconnectPlayer'
  | 'getGameState'

type PublicAction = 'createGame' | 'joinGame'

type ActionPayloadMap = {
  createGame: {
    playerName: string
    maxCards: CardCount
  }
  joinGame: {
    gameId: string
    playerName: string
  }
  setOptions: {
    gameId: string
    version: number
    maxCards: CardCount
    blindBid: boolean
  }
  startGame: {
    gameId: string
    version: number
  }
  dealCards: {
    gameId: string
    version: number
  }
  submitBid: {
    gameId: string
    version: number
    bid: number
  }
  playCard: {
    gameId: string
    version: number
    card: Card
  }
  movePlayer: {
    gameId: string
    version: number
    playerId: string
    direction: string
  }
  removePlayer: {
    gameId: string
    version: number
    playerId: string
  }
  reconnectPlayer: {
    gameId: string
    version: number
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

export type LambdaEventPayload<TAction extends LambdaAction = LambdaAction> = {
  action: TAction
  payload: LambdaPayloadForAction<TAction>
}
