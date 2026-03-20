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

const updateStateField = (state, key, value) => {
  const nextValue = resolveNextValue(state[key], value)
  if (Object.is(state[key], nextValue)) {
    return state
  }

  return {
    ...state,
    [key]: nextValue,
  }
}

const appStateReducer = (state, action) => {
  switch (action.type) {
    case 'create_player_name_changed':
      return {
        ...state,
        playerName: action.value,
        createErrors: {
          ...state.createErrors,
          playerName: undefined,
        },
      }
    case 'join_game_id_changed':
      return {
        ...state,
        joinGameId: action.value,
        joinErrors: {
          ...state.joinErrors,
          gameId: undefined,
        },
      }
    case 'join_player_name_changed':
      return {
        ...state,
        joinPlayerName: action.value,
        joinErrors: {
          ...state.joinErrors,
          playerName: undefined,
        },
      }
    case 'clear_home_request_state':
      return {
        ...state,
        requestError: '',
        sessionInfo: null,
      }
    case 'reset_create_draft':
      return {
        ...state,
        playerName: '',
        createErrors: {},
      }
    case 'reset_join_draft':
      return {
        ...state,
        selectedRejoinGameId: '',
        joinGameId: '',
        joinPlayerName: '',
        joinErrors: {},
      }
    case 'rejoin_selection_changed': {
      const nextGameId = action.gameId
      const selectedGame = action.selectedGame

      if (nextGameId) {
        return {
          ...state,
          selectedRejoinGameId: nextGameId,
          joinGameId: nextGameId,
          joinPlayerName: selectedGame?.playerName ?? '',
          joinErrors: {
            ...state.joinErrors,
            gameId: undefined,
            playerName: undefined,
          },
          joinMenuCloseRequestKey: state.joinMenuCloseRequestKey + 1,
        }
      }

      return {
        ...state,
        selectedRejoinGameId: '',
        joinGameId: '',
        joinPlayerName: '',
      }
    }
    case 'create_game_validation_failed':
      return {
        ...state,
        createErrors: action.errors,
      }
    case 'create_game_started':
      return {
        ...state,
        createErrors: {},
        requestError: '',
        isCreatingGame: true,
      }
    case 'create_game_failed':
      return {
        ...state,
        requestError: action.message,
        isCreatingGame: false,
      }
    case 'create_game_succeeded':
      return {
        ...state,
        isCreatingGame: false,
        sessionInfo: action.sessionInfo,
        ownerSession: action.ownerSession,
        playerSession: null,
        selectedMaxCards: action.selectedMaxCards,
        selectedAiDifficulty: action.selectedAiDifficulty,
        gameError: '',
        lobbyInfo: '',
        playerName: '',
        createErrors: {},
      }
    case 'join_game_validation_failed':
      return {
        ...state,
        joinErrors: action.errors,
      }
    case 'join_game_started':
      return {
        ...state,
        joinErrors: {},
        requestError: '',
        isJoiningGame: true,
      }
    case 'join_game_failed':
      return {
        ...state,
        requestError: action.message,
        isJoiningGame: false,
      }
    case 'join_game_succeeded':
      return {
        ...state,
        isJoiningGame: false,
        sessionInfo: action.sessionInfo,
        ownerSession: null,
        playerSession: action.playerSession,
        gameError: '',
        lobbyInfo: '',
        selectedRejoinGameId: '',
        joinGameId: '',
        joinPlayerName: '',
        joinErrors: {},
      }
    case 'rejoin_game_started':
      return {
        ...state,
        requestError: '',
        isRejoiningGame: true,
      }
    case 'rejoin_game_failed':
      return {
        ...state,
        requestError: action.message,
        isRejoiningGame: false,
      }
    case 'rejoin_game_succeeded':
      return {
        ...state,
        isRejoiningGame: false,
        sessionInfo: action.sessionInfo,
        ownerSession: action.role === 'owner' ? action.session : null,
        playerSession: action.role === 'player' ? action.session : null,
        gameError: '',
        lobbyInfo: '',
        selectedRejoinGameId: '',
        joinGameId: '',
        joinPlayerName: '',
        joinErrors: {},
        selectedMaxCards: action.selectedMaxCards ?? state.selectedMaxCards,
        selectedAiDifficulty: action.selectedAiDifficulty ?? state.selectedAiDifficulty,
      }
    case 'rejoinable_games_loading_started':
      return {
        ...state,
        isLoadingRejoinGames: true,
      }
    case 'rejoinable_games_loaded':
      return {
        ...state,
        rejoinableGames: action.games,
        selectedRejoinGameId:
          state.selectedRejoinGameId && action.games.some((entry) => entry.gameId === state.selectedRejoinGameId)
            ? state.selectedRejoinGameId
            : '',
        isLoadingRejoinGames: false,
      }
    case 'session_restore_initialized':
      return {
        ...state,
        joinGameId: action.gameId,
      }
    case 'session_restore_succeeded':
      return {
        ...state,
        ownerSession: action.role === 'owner' ? action.session : null,
        playerSession: action.role === 'player' ? action.session : null,
        selectedMaxCards: action.selectedMaxCards ?? state.selectedMaxCards,
        selectedAiDifficulty: action.selectedAiDifficulty ?? state.selectedAiDifficulty,
      }
    case 'session_feedback_cleared':
      return {
        ...state,
        gameError: '',
        lobbyInfo: '',
      }
    case 'set_create_errors':
      return updateStateField(state, 'createErrors', action.value)
    case 'set_game_error':
      return updateStateField(state, 'gameError', action.value)
    case 'set_is_continuing_game':
      return updateStateField(state, 'isContinuingGame', action.value)
    case 'set_is_dealing_cards':
      return updateStateField(state, 'isDealingCards', action.value)
    case 'set_is_leaving_game':
      return updateStateField(state, 'isLeavingGame', action.value)
    case 'set_is_playing_card':
      return updateStateField(state, 'isPlayingCard', action.value)
    case 'set_is_renaming_player':
      return updateStateField(state, 'isRenamingPlayer', action.value)
    case 'set_is_sending_reaction':
      return updateStateField(state, 'isSendingReaction', action.value)
    case 'set_is_sorting_cards':
      return updateStateField(state, 'isSortingCards', action.value)
    case 'set_is_starting_game':
      return updateStateField(state, 'isStartingGame', action.value)
    case 'set_is_starting_over':
      return updateStateField(state, 'isStartingOver', action.value)
    case 'set_is_submitting_bid':
      return updateStateField(state, 'isSubmittingBid', action.value)
    case 'set_join_errors':
      return updateStateField(state, 'joinErrors', action.value)
    case 'set_join_menu_close_request_key':
      return updateStateField(state, 'joinMenuCloseRequestKey', action.value)
    case 'set_lobby_info':
      return updateStateField(state, 'lobbyInfo', action.value)
    case 'set_owner_session':
      return updateStateField(state, 'ownerSession', action.value)
    case 'set_pending_player_action_id':
      return updateStateField(state, 'pendingPlayerActionId', action.value)
    case 'set_persisted_end_of_round_summary':
      return updateStateField(state, 'persistedEndOfRoundSummary', action.value)
    case 'set_player_session':
      return updateStateField(state, 'playerSession', action.value)
    case 'set_reaction_cooldown_until':
      return updateStateField(state, 'reactionCooldownUntil', action.value)
    case 'set_request_error':
      return updateStateField(state, 'requestError', action.value)
    case 'set_selected_ai_difficulty':
      return updateStateField(state, 'selectedAiDifficulty', action.value)
    case 'set_selected_max_cards':
      return updateStateField(state, 'selectedMaxCards', action.value)
    case 'set_session_info':
      return updateStateField(state, 'sessionInfo', action.value)
    case 'set_sort_mode':
      return updateStateField(state, 'sortMode', action.value)
    default:
      return state
  }
}

export function useAppState() {
  const [state, dispatch] = useReducer(appStateReducer, INITIAL_APP_STATE)

  const actions = useMemo(() => ({
    clearHomeRequestState: () => dispatch({ type: 'clear_home_request_state' }),
    createGameFailed: (message) => dispatch({ type: 'create_game_failed', message }),
    createGameStarted: () => dispatch({ type: 'create_game_started' }),
    createGameSucceeded: (payload) => dispatch({ type: 'create_game_succeeded', ...payload }),
    createGameValidationFailed: (errors) => dispatch({ type: 'create_game_validation_failed', errors }),
    resetCreateDraft: () => dispatch({ type: 'reset_create_draft' }),
    resetJoinDraft: () => dispatch({ type: 'reset_join_draft' }),
    rejoinGameFailed: (message) => dispatch({ type: 'rejoin_game_failed', message }),
    rejoinGameStarted: () => dispatch({ type: 'rejoin_game_started' }),
    rejoinGameSucceeded: (payload) => dispatch({ type: 'rejoin_game_succeeded', ...payload }),
    rejoinSelectionChanged: (gameId, selectedGame) =>
      dispatch({ type: 'rejoin_selection_changed', gameId, selectedGame }),
    rejoinableGamesLoaded: (games) => dispatch({ type: 'rejoinable_games_loaded', games }),
    rejoinableGamesLoadingStarted: () => dispatch({ type: 'rejoinable_games_loading_started' }),
    joinGameFailed: (message) => dispatch({ type: 'join_game_failed', message }),
    joinGameIdChanged: (value) => dispatch({ type: 'join_game_id_changed', value }),
    joinGameStarted: () => dispatch({ type: 'join_game_started' }),
    joinGameSucceeded: (payload) => dispatch({ type: 'join_game_succeeded', ...payload }),
    joinGameValidationFailed: (errors) => dispatch({ type: 'join_game_validation_failed', errors }),
    joinPlayerNameChanged: (value) => dispatch({ type: 'join_player_name_changed', value }),
    sessionFeedbackCleared: () => dispatch({ type: 'session_feedback_cleared' }),
    sessionRestoreInitialized: (gameId) => dispatch({ type: 'session_restore_initialized', gameId }),
    sessionRestoreSucceeded: (payload) => dispatch({ type: 'session_restore_succeeded', ...payload }),
    setCreateErrors: (value) => dispatch({ type: 'set_create_errors', value }),
    setGameError: (value) => dispatch({ type: 'set_game_error', value }),
    setIsContinuingGame: (value) => dispatch({ type: 'set_is_continuing_game', value }),
    setIsDealingCards: (value) => dispatch({ type: 'set_is_dealing_cards', value }),
    setIsLeavingGame: (value) => dispatch({ type: 'set_is_leaving_game', value }),
    setIsPlayingCard: (value) => dispatch({ type: 'set_is_playing_card', value }),
    setIsRenamingPlayer: (value) => dispatch({ type: 'set_is_renaming_player', value }),
    setIsSendingReaction: (value) => dispatch({ type: 'set_is_sending_reaction', value }),
    setIsSortingCards: (value) => dispatch({ type: 'set_is_sorting_cards', value }),
    setIsStartingGame: (value) => dispatch({ type: 'set_is_starting_game', value }),
    setIsStartingOver: (value) => dispatch({ type: 'set_is_starting_over', value }),
    setIsSubmittingBid: (value) => dispatch({ type: 'set_is_submitting_bid', value }),
    setJoinErrors: (value) => dispatch({ type: 'set_join_errors', value }),
    setJoinMenuCloseRequestKey: (value) => dispatch({ type: 'set_join_menu_close_request_key', value }),
    setLobbyInfo: (value) => dispatch({ type: 'set_lobby_info', value }),
    setOwnerSession: (value) => dispatch({ type: 'set_owner_session', value }),
    setPendingPlayerActionId: (value) => dispatch({ type: 'set_pending_player_action_id', value }),
    setPersistedEndOfRoundSummary: (value) => dispatch({ type: 'set_persisted_end_of_round_summary', value }),
    setPlayerSession: (value) => dispatch({ type: 'set_player_session', value }),
    setReactionCooldownUntil: (value) => dispatch({ type: 'set_reaction_cooldown_until', value }),
    setRequestError: (value) => dispatch({ type: 'set_request_error', value }),
    setSelectedAiDifficulty: (value) => dispatch({ type: 'set_selected_ai_difficulty', value }),
    setSelectedMaxCards: (value) => dispatch({ type: 'set_selected_max_cards', value }),
    setSessionInfo: (value) => dispatch({ type: 'set_session_info', value }),
    setSortMode: (value) => dispatch({ type: 'set_sort_mode', value }),
    setPlayerName: (value) => dispatch({ type: 'create_player_name_changed', value }),
  }), [])

  return {
    appState: state,
    appActions: actions,
  }
}
