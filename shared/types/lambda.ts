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
  }
  joinGame: {
    gameId: string
    playerName: string
  }
  setOptions: {
    gameId: string
    maxCards: CardCount
    blindBid: boolean
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
  removePlayer: {
    gameId: string
    playerId: string
  }
  reconnectPlayer: {
    gameId: string
  }
  getGameState: {
    gameId: string
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
