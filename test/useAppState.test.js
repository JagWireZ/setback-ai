import test from 'node:test'
import assert from 'node:assert/strict'

import {
  appStateReducer,
  createInitialAppState,
} from '../src/hooks/useAppState.js'

test('form reset actions clear create and join drafts', () => {
  let state = createInitialAppState()

  state = appStateReducer(state, { type: 'create_player_name_changed', value: 'Casey' })
  state = appStateReducer(state, {
    type: 'join_game_validation_failed',
    errors: { gameId: 'Required', playerName: 'Required' },
  })
  state = appStateReducer(state, {
    type: 'rejoin_selection_changed',
    gameId: 'game-9',
    selectedGame: { gameId: 'game-9', playerName: 'Morgan' },
  })
  state = appStateReducer(state, { type: 'reset_create_draft' })
  state = appStateReducer(state, { type: 'reset_join_draft' })

  assert.equal(state.home.playerName, '')
  assert.deepEqual(state.home.createErrors, {})
  assert.equal(state.home.selectedRejoinGameId, '')
  assert.equal(state.home.joinGameId, '')
  assert.equal(state.home.joinPlayerName, '')
  assert.deepEqual(state.home.joinErrors, {})
})

test('rejoin selection updates join form state and close request key', () => {
  const initialState = createInitialAppState()

  const selectedState = appStateReducer(initialState, {
    type: 'rejoin_selection_changed',
    gameId: 'game-22',
    selectedGame: { gameId: 'game-22', playerName: 'Taylor' },
  })

  assert.equal(selectedState.home.selectedRejoinGameId, 'game-22')
  assert.equal(selectedState.home.joinGameId, 'game-22')
  assert.equal(selectedState.home.joinPlayerName, 'Taylor')
  assert.equal(selectedState.home.joinMenuCloseRequestKey, 1)

  const clearedState = appStateReducer(selectedState, {
    type: 'rejoin_selection_changed',
    gameId: '',
    selectedGame: null,
  })

  assert.equal(clearedState.home.selectedRejoinGameId, '')
  assert.equal(clearedState.home.joinGameId, '')
  assert.equal(clearedState.home.joinPlayerName, '')
  assert.equal(clearedState.home.joinMenuCloseRequestKey, 1)
})

test('request lifecycle actions toggle request flags and surface errors', () => {
  let state = createInitialAppState()

  state = appStateReducer(state, { type: 'create_game_started' })
  assert.equal(state.requests.isCreatingGame, true)
  assert.equal(state.home.requestError, '')

  state = appStateReducer(state, { type: 'create_game_failed', message: 'Unable to create game.' })
  assert.equal(state.requests.isCreatingGame, false)
  assert.equal(state.home.requestError, 'Unable to create game.')

  state = appStateReducer(state, { type: 'join_game_started' })
  assert.equal(state.requests.isJoiningGame, true)

  state = appStateReducer(state, { type: 'join_game_failed', message: 'Unable to join game.' })
  assert.equal(state.requests.isJoiningGame, false)
  assert.equal(state.home.requestError, 'Unable to join game.')

  state = appStateReducer(state, { type: 'rejoinable_games_loading_started' })
  assert.equal(state.requests.isLoadingRejoinGames, true)

  state = appStateReducer(state, {
    type: 'rejoinable_games_loaded',
    games: [{ gameId: 'game-1', playerName: 'Jamie' }],
  })
  assert.equal(state.requests.isLoadingRejoinGames, false)
  assert.deepEqual(state.home.rejoinableGames, [{ gameId: 'game-1', playerName: 'Jamie' }])
})

test('session success actions switch cleanly between owner and player sessions', () => {
  const ownerSession = { gameId: 'game-owner', playerToken: 'owner-token' }
  const playerSession = { gameId: 'game-player', playerToken: 'player-token', version: 3 }

  let state = createInitialAppState()

  state = appStateReducer(state, {
    type: 'create_game_succeeded',
    sessionInfo: { action: 'createGame', gameId: 'game-owner' },
    ownerSession,
    selectedMaxCards: '12',
    selectedAiDifficulty: 'hard',
  })

  assert.equal(state.session.ownerSession, ownerSession)
  assert.equal(state.session.playerSession, null)
  assert.equal(state.game.selectedMaxCards, '12')
  assert.equal(state.game.selectedAiDifficulty, 'hard')

  state = appStateReducer(state, {
    type: 'join_game_succeeded',
    sessionInfo: { action: 'joinGame', gameId: 'game-player' },
    playerSession,
  })

  assert.equal(state.session.ownerSession, null)
  assert.equal(state.session.playerSession, playerSession)

  state = appStateReducer(state, {
    type: 'rejoin_game_succeeded',
    role: 'owner',
    session: ownerSession,
    sessionInfo: { action: 'rejoinGame', gameId: 'game-owner' },
  })

  assert.equal(state.session.ownerSession, ownerSession)
  assert.equal(state.session.playerSession, null)
})

test('session clearing and feedback clearing reset shared home and game feedback', () => {
  let state = createInitialAppState()

  state = appStateReducer(state, {
    type: 'create_game_succeeded',
    sessionInfo: { action: 'createGame', gameId: 'game-1' },
    ownerSession: { gameId: 'game-1', playerToken: 'owner-token' },
    selectedMaxCards: '11',
    selectedAiDifficulty: 'medium',
  })
  state = appStateReducer(state, { type: 'set_game_error', value: 'Problem' })
  state = appStateReducer(state, { type: 'set_lobby_info', value: 'Saved' })
  state = appStateReducer(state, { type: 'clear_home_request_state' })
  state = appStateReducer(state, { type: 'session_feedback_cleared' })

  assert.equal(state.home.requestError, '')
  assert.equal(state.home.sessionInfo, null)
  assert.equal(state.game.gameError, '')
  assert.equal(state.game.lobbyInfo, '')
  assert.equal(state.session.ownerSession?.gameId, 'game-1')
})

test('persisted round summary field updates through the game slice', () => {
  const summary = {
    roundIndex: 2,
    bids: [{ playerId: 'p1', bid: 3 }],
  }

  let state = createInitialAppState()
  state = appStateReducer(state, {
    type: 'set_persisted_end_of_round_summary',
    value: summary,
  })

  assert.deepEqual(state.game.persistedEndOfRoundSummary, summary)

  state = appStateReducer(state, {
    type: 'set_persisted_end_of_round_summary',
    value: null,
  })

  assert.equal(state.game.persistedEndOfRoundSummary, null)
})
