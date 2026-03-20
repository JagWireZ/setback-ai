import { useMemo, useReducer } from 'react'

const INITIAL_APP_STATE = {
  playerName: '',
  selectedMaxCards: '10',
  selectedAiDifficulty: 'medium',
  joinGameId: '',
  selectedRejoinGameId: '',
  joinPlayerName: '',
  createErrors: {},
  joinErrors: {},
  isCreatingGame: false,
  isJoiningGame: false,
  isRejoiningGame: false,
  isLoadingRejoinGames: false,
  joinMenuCloseRequestKey: 0,
  requestError: '',
  sessionInfo: null,
  rejoinableGames: [],
  ownerSession: null,
  playerSession: null,
  gameError: '',
  lobbyInfo: '',
  isStartingGame: false,
  isDealingCards: false,
  sortMode: 'bySuit',
  isSubmittingBid: false,
  isPlayingCard: false,
  isSendingReaction: false,
  isRenamingPlayer: false,
  isSortingCards: false,
  isContinuingGame: false,
  isLeavingGame: false,
  isStartingOver: false,
  persistedEndOfRoundSummary: null,
  pendingPlayerActionId: '',
  reactionCooldownUntil: 0,
}

const resolveNextValue = (currentValue, nextValue) =>
  typeof nextValue === 'function' ? nextValue(currentValue) : nextValue

const appStateReducer = (state, action) => {
  switch (action.type) {
    case 'set_field': {
      const nextValue = resolveNextValue(state[action.key], action.value)
      if (Object.is(state[action.key], nextValue)) {
        return state
      }

      return {
        ...state,
        [action.key]: nextValue,
      }
    }
    default:
      return state
  }
}

export function useAppState() {
  const [state, dispatch] = useReducer(appStateReducer, INITIAL_APP_STATE)

  const actions = useMemo(() => {
    const setField = (key) => (value) => dispatch({ type: 'set_field', key, value })

    return {
      setCreateErrors: setField('createErrors'),
      setGameError: setField('gameError'),
      setIsContinuingGame: setField('isContinuingGame'),
      setIsCreatingGame: setField('isCreatingGame'),
      setIsDealingCards: setField('isDealingCards'),
      setIsJoiningGame: setField('isJoiningGame'),
      setIsLeavingGame: setField('isLeavingGame'),
      setIsLoadingRejoinGames: setField('isLoadingRejoinGames'),
      setIsPlayingCard: setField('isPlayingCard'),
      setIsRejoiningGame: setField('isRejoiningGame'),
      setIsRenamingPlayer: setField('isRenamingPlayer'),
      setIsSendingReaction: setField('isSendingReaction'),
      setIsSortingCards: setField('isSortingCards'),
      setIsStartingGame: setField('isStartingGame'),
      setIsStartingOver: setField('isStartingOver'),
      setIsSubmittingBid: setField('isSubmittingBid'),
      setJoinErrors: setField('joinErrors'),
      setJoinGameId: setField('joinGameId'),
      setJoinMenuCloseRequestKey: setField('joinMenuCloseRequestKey'),
      setJoinPlayerName: setField('joinPlayerName'),
      setLobbyInfo: setField('lobbyInfo'),
      setOwnerSession: setField('ownerSession'),
      setPendingPlayerActionId: setField('pendingPlayerActionId'),
      setPersistedEndOfRoundSummary: setField('persistedEndOfRoundSummary'),
      setPlayerName: setField('playerName'),
      setPlayerSession: setField('playerSession'),
      setReactionCooldownUntil: setField('reactionCooldownUntil'),
      setRejoinableGames: setField('rejoinableGames'),
      setRequestError: setField('requestError'),
      setSelectedAiDifficulty: setField('selectedAiDifficulty'),
      setSelectedMaxCards: setField('selectedMaxCards'),
      setSelectedRejoinGameId: setField('selectedRejoinGameId'),
      setSessionInfo: setField('sessionInfo'),
      setSortMode: setField('sortMode'),
    }
  }, [])

  return {
    appState: state,
    appActions: actions,
  }
}
