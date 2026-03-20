import { useMemo, useReducer } from 'react'

const INITIAL_APP_STATE = {
  home: {
    playerName: '',
    joinGameId: '',
    selectedRejoinGameId: '',
    joinPlayerName: '',
    createErrors: {},
    joinErrors: {},
    joinMenuCloseRequestKey: 0,
    requestError: '',
    sessionInfo: null,
    rejoinableGames: [],
  },
  session: {
    ownerSession: null,
    playerSession: null,
  },
  game: {
    selectedMaxCards: '10',
    selectedAiDifficulty: 'medium',
    gameError: '',
    lobbyInfo: '',
    sortMode: 'bySuit',
    persistedEndOfRoundSummary: null,
    pendingPlayerActionId: '',
    reactionCooldownUntil: 0,
  },
  requests: {
    isCreatingGame: false,
    isJoiningGame: false,
    isRejoiningGame: false,
    isLoadingRejoinGames: false,
    isStartingGame: false,
    isDealingCards: false,
    isSubmittingBid: false,
    isPlayingCard: false,
    isSendingReaction: false,
    isRenamingPlayer: false,
    isSortingCards: false,
    isContinuingGame: false,
    isLeavingGame: false,
    isStartingOver: false,
  },
}

const resolveNextValue = (currentValue, nextValue) =>
  typeof nextValue === 'function' ? nextValue(currentValue) : nextValue

const updateStateField = (state, slice, key, value) => {
  const nextValue = resolveNextValue(state[slice][key], value)
  if (Object.is(state[slice][key], nextValue)) {
    return state
  }

  return {
    ...state,
    [slice]: {
      ...state[slice],
      [key]: nextValue,
    },
  }
}

const appStateReducer = (state, action) => {
  switch (action.type) {
    case 'create_player_name_changed':
      return {
        ...state,
        home: {
          ...state.home,
          playerName: action.value,
          createErrors: {
            ...state.home.createErrors,
            playerName: undefined,
          },
        },
      }
    case 'join_game_id_changed':
      return {
        ...state,
        home: {
          ...state.home,
          joinGameId: action.value,
          joinErrors: {
            ...state.home.joinErrors,
            gameId: undefined,
          },
        },
      }
    case 'join_player_name_changed':
      return {
        ...state,
        home: {
          ...state.home,
          joinPlayerName: action.value,
          joinErrors: {
            ...state.home.joinErrors,
            playerName: undefined,
          },
        },
      }
    case 'clear_home_request_state':
      return {
        ...state,
        home: {
          ...state.home,
          requestError: '',
          sessionInfo: null,
        },
      }
    case 'reset_create_draft':
      return {
        ...state,
        home: {
          ...state.home,
          playerName: '',
          createErrors: {},
        },
      }
    case 'reset_join_draft':
      return {
        ...state,
        home: {
          ...state.home,
          selectedRejoinGameId: '',
          joinGameId: '',
          joinPlayerName: '',
          joinErrors: {},
        },
      }
    case 'rejoin_selection_changed': {
      const nextGameId = action.gameId
      const selectedGame = action.selectedGame

      return {
        ...state,
        home: {
          ...state.home,
          selectedRejoinGameId: nextGameId,
          joinGameId: nextGameId,
          joinPlayerName: nextGameId ? (selectedGame?.playerName ?? '') : '',
          joinErrors: nextGameId
            ? {
                ...state.home.joinErrors,
                gameId: undefined,
                playerName: undefined,
              }
            : state.home.joinErrors,
          joinMenuCloseRequestKey: nextGameId
            ? state.home.joinMenuCloseRequestKey + 1
            : state.home.joinMenuCloseRequestKey,
        },
      }
    }
    case 'create_game_validation_failed':
      return {
        ...state,
        home: {
          ...state.home,
          createErrors: action.errors,
        },
      }
    case 'create_game_started':
      return {
        ...state,
        home: {
          ...state.home,
          createErrors: {},
          requestError: '',
        },
        requests: {
          ...state.requests,
          isCreatingGame: true,
        },
      }
    case 'create_game_failed':
      return {
        ...state,
        home: {
          ...state.home,
          requestError: action.message,
        },
        requests: {
          ...state.requests,
          isCreatingGame: false,
        },
      }
    case 'create_game_succeeded':
      return {
        ...state,
        home: {
          ...state.home,
          playerName: '',
          createErrors: {},
          sessionInfo: action.sessionInfo,
        },
        session: {
          ownerSession: action.ownerSession,
          playerSession: null,
        },
        game: {
          ...state.game,
          selectedMaxCards: action.selectedMaxCards,
          selectedAiDifficulty: action.selectedAiDifficulty,
          gameError: '',
          lobbyInfo: '',
        },
        requests: {
          ...state.requests,
          isCreatingGame: false,
        },
      }
    case 'join_game_validation_failed':
      return {
        ...state,
        home: {
          ...state.home,
          joinErrors: action.errors,
        },
      }
    case 'join_game_started':
      return {
        ...state,
        home: {
          ...state.home,
          joinErrors: {},
          requestError: '',
        },
        requests: {
          ...state.requests,
          isJoiningGame: true,
        },
      }
    case 'join_game_failed':
      return {
        ...state,
        home: {
          ...state.home,
          requestError: action.message,
        },
        requests: {
          ...state.requests,
          isJoiningGame: false,
        },
      }
    case 'join_game_succeeded':
      return {
        ...state,
        home: {
          ...state.home,
          selectedRejoinGameId: '',
          joinGameId: '',
          joinPlayerName: '',
          joinErrors: {},
          sessionInfo: action.sessionInfo,
        },
        session: {
          ownerSession: null,
          playerSession: action.playerSession,
        },
        game: {
          ...state.game,
          gameError: '',
          lobbyInfo: '',
        },
        requests: {
          ...state.requests,
          isJoiningGame: false,
        },
      }
    case 'rejoin_game_started':
      return {
        ...state,
        home: {
          ...state.home,
          requestError: '',
        },
        requests: {
          ...state.requests,
          isRejoiningGame: true,
        },
      }
    case 'rejoin_game_failed':
      return {
        ...state,
        home: {
          ...state.home,
          requestError: action.message,
        },
        requests: {
          ...state.requests,
          isRejoiningGame: false,
        },
      }
    case 'rejoin_game_succeeded':
      return {
        ...state,
        home: {
          ...state.home,
          selectedRejoinGameId: '',
          joinGameId: '',
          joinPlayerName: '',
          joinErrors: {},
          sessionInfo: action.sessionInfo,
        },
        session: {
          ownerSession: action.role === 'owner' ? action.session : null,
          playerSession: action.role === 'player' ? action.session : null,
        },
        game: {
          ...state.game,
          selectedMaxCards: action.selectedMaxCards ?? state.game.selectedMaxCards,
          selectedAiDifficulty: action.selectedAiDifficulty ?? state.game.selectedAiDifficulty,
          gameError: '',
          lobbyInfo: '',
        },
        requests: {
          ...state.requests,
          isRejoiningGame: false,
        },
      }
    case 'rejoinable_games_loading_started':
      return {
        ...state,
        requests: {
          ...state.requests,
          isLoadingRejoinGames: true,
        },
      }
    case 'rejoinable_games_loaded':
      return {
        ...state,
        home: {
          ...state.home,
          rejoinableGames: action.games,
          selectedRejoinGameId:
            state.home.selectedRejoinGameId &&
            action.games.some((entry) => entry.gameId === state.home.selectedRejoinGameId)
              ? state.home.selectedRejoinGameId
              : '',
        },
        requests: {
          ...state.requests,
          isLoadingRejoinGames: false,
        },
      }
    case 'session_restore_initialized':
      return {
        ...state,
        home: {
          ...state.home,
          joinGameId: action.gameId,
        },
      }
    case 'session_restore_succeeded':
      return {
        ...state,
        session: {
          ownerSession: action.role === 'owner' ? action.session : null,
          playerSession: action.role === 'player' ? action.session : null,
        },
        game: {
          ...state.game,
          selectedMaxCards: action.selectedMaxCards ?? state.game.selectedMaxCards,
          selectedAiDifficulty: action.selectedAiDifficulty ?? state.game.selectedAiDifficulty,
        },
      }
    case 'session_feedback_cleared':
      return {
        ...state,
        game: {
          ...state.game,
          gameError: '',
          lobbyInfo: '',
        },
      }
    case 'set_create_errors':
      return updateStateField(state, 'home', 'createErrors', action.value)
    case 'set_game_error':
      return updateStateField(state, 'game', 'gameError', action.value)
    case 'set_is_continuing_game':
      return updateStateField(state, 'requests', 'isContinuingGame', action.value)
    case 'set_is_dealing_cards':
      return updateStateField(state, 'requests', 'isDealingCards', action.value)
    case 'set_is_leaving_game':
      return updateStateField(state, 'requests', 'isLeavingGame', action.value)
    case 'set_is_playing_card':
      return updateStateField(state, 'requests', 'isPlayingCard', action.value)
    case 'set_is_renaming_player':
      return updateStateField(state, 'requests', 'isRenamingPlayer', action.value)
    case 'set_is_sending_reaction':
      return updateStateField(state, 'requests', 'isSendingReaction', action.value)
    case 'set_is_sorting_cards':
      return updateStateField(state, 'requests', 'isSortingCards', action.value)
    case 'set_is_starting_game':
      return updateStateField(state, 'requests', 'isStartingGame', action.value)
    case 'set_is_starting_over':
      return updateStateField(state, 'requests', 'isStartingOver', action.value)
    case 'set_is_submitting_bid':
      return updateStateField(state, 'requests', 'isSubmittingBid', action.value)
    case 'set_join_errors':
      return updateStateField(state, 'home', 'joinErrors', action.value)
    case 'set_join_menu_close_request_key':
      return updateStateField(state, 'home', 'joinMenuCloseRequestKey', action.value)
    case 'set_lobby_info':
      return updateStateField(state, 'game', 'lobbyInfo', action.value)
    case 'set_owner_session':
      return updateStateField(state, 'session', 'ownerSession', action.value)
    case 'set_pending_player_action_id':
      return updateStateField(state, 'game', 'pendingPlayerActionId', action.value)
    case 'set_persisted_end_of_round_summary':
      return updateStateField(state, 'game', 'persistedEndOfRoundSummary', action.value)
    case 'set_player_session':
      return updateStateField(state, 'session', 'playerSession', action.value)
    case 'set_reaction_cooldown_until':
      return updateStateField(state, 'game', 'reactionCooldownUntil', action.value)
    case 'set_request_error':
      return updateStateField(state, 'home', 'requestError', action.value)
    case 'set_selected_ai_difficulty':
      return updateStateField(state, 'game', 'selectedAiDifficulty', action.value)
    case 'set_selected_max_cards':
      return updateStateField(state, 'game', 'selectedMaxCards', action.value)
    case 'set_session_info':
      return updateStateField(state, 'home', 'sessionInfo', action.value)
    case 'set_sort_mode':
      return updateStateField(state, 'game', 'sortMode', action.value)
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
