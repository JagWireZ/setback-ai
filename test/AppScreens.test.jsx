import test from 'node:test'
import assert from 'node:assert/strict'
import '../test/setupDom.js'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

import { ActiveGameScreen, HomeScreen, LobbyScreen } from '../src/components/AppScreens.jsx'

test.afterEach(() => {
  cleanup()
})

const Icon = (props) => <svg data-testid="icon" {...props} />

test('ActiveGameScreen renders each slot it is given', () => {
  render(
    <ActiveGameScreen
      gameTable={<div>table</div>}
      bidModal={<div>bid</div>}
      endOfRoundModal={<div>end-of-round</div>}
      joinModal={<div>join</div>}
      awayContinueModal={<div>away</div>}
      helpModal={<div>help</div>}
    />,
  )

  for (const text of ['table', 'bid', 'end-of-round', 'join', 'away', 'help']) {
    assert.ok(screen.getByText(text))
  }
})

const buildLobbyProps = (overrides = {}) => ({
  activeLobbySession: { gameId: 'brave-otter' },
  gameError: '',
  lobbyInfo: '',
  orderedPlayers: [
    { id: 'p1', name: 'Casey', type: 'human' },
    { id: 'p2', name: 'Robin', type: 'ai' },
  ],
  currentDealerPlayerId: 'p2',
  activeLobbyPlayerId: 'p1',
  isOwnerLobby: true,
  ownerSession: { ownerPlayerId: 'p1', game: { phase: { stage: 'Lobby' } } },
  isRenamingPlayer: false,
  isStartingGame: false,
  openLobbyRenamePlayerModal: () => {},
  pendingPlayerActionId: '',
  handleMovePlayer: () => {},
  openLobbyRemoveSeatConfirm: () => {},
  openLobbyRemovePlayerConfirm: () => {},
  handleAddSeat: () => {},
  maxSeats: 8,
  maxCardsForLobbySeatCount: 10,
  selectedMaxCards: '10',
  setSelectedMaxCards: () => {},
  selectedAiDifficulty: 'medium',
  setSelectedAiDifficulty: () => {},
  aiDifficultyOptions: [{ value: 'medium', label: 'Medium' }],
  resetActiveSessionState: () => {},
  handleStartGame: () => {},
  openShareModal: () => {},
  getPlayerPresence: () => ({ away: false }),
  ShareIcon: Icon,
  ...overrides,
})

test('LobbyScreen renders the player roster, game id, and owner controls', () => {
  const lobby = buildLobbyProps()
  render(<LobbyScreen lobby={lobby} />)

  assert.ok(screen.getByText('brave-otter'))
  assert.ok(screen.getByText('Players (2)'))
  assert.ok(screen.getByRole('button', { name: 'Rename Casey' }))
  assert.ok(screen.getByText('Dealer'))
  assert.ok(screen.getByRole('button', { name: 'Start Game' }))
  assert.ok(screen.getByRole('button', { name: 'Add Seat' }))
})

test('LobbyScreen hides seat management controls for a non-owner viewer', () => {
  const lobby = buildLobbyProps({ isOwnerLobby: false })
  render(<LobbyScreen lobby={lobby} />)

  assert.equal(screen.queryByRole('button', { name: 'Add Seat' }), null)
  assert.equal(screen.queryByRole('button', { name: 'Remove Casey' }), null)
  assert.ok(screen.getByText('Waiting for game to start...'))
})

test('LobbyScreen shows game/lobby feedback messages when present', () => {
  const lobby = buildLobbyProps({ gameError: 'Something broke.', lobbyInfo: 'Seat added.' })
  render(<LobbyScreen lobby={lobby} />)

  assert.ok(screen.getByText('Something broke.'))
  assert.ok(screen.getByText('Seat added.'))
})

test('LobbyScreen disables removing the owner and disables removing the last AI seat', () => {
  const lobby = buildLobbyProps()
  render(<LobbyScreen lobby={lobby} />)

  assert.equal(screen.getByRole('button', { name: 'Remove Casey' }).disabled, true)
  assert.equal(screen.getByRole('button', { name: 'Remove Robin' }).disabled, true)
})

test('LobbyScreen enables removing a non-owner human and an AI seat when there are more than two players', () => {
  const lobby = buildLobbyProps({
    orderedPlayers: [
      { id: 'p1', name: 'Casey', type: 'human' },
      { id: 'p2', name: 'Robin', type: 'ai' },
      { id: 'p3', name: 'Jordan', type: 'human' },
    ],
  })
  render(<LobbyScreen lobby={lobby} />)

  assert.equal(screen.getByRole('button', { name: 'Remove Jordan' }).disabled, false)
  assert.equal(screen.getByRole('button', { name: 'Remove Robin' }).disabled, false)
})

test('LobbyScreen move-player buttons call handleMovePlayer with the direction', () => {
  const calls = []
  const lobby = buildLobbyProps({ handleMovePlayer: (playerId, direction) => calls.push([playerId, direction]) })
  render(<LobbyScreen lobby={lobby} />)

  fireEvent.click(screen.getByRole('button', { name: 'Move Casey up' }))
  fireEvent.click(screen.getByRole('button', { name: 'Move Casey down' }))

  assert.deepEqual(calls, [['p1', 'left'], ['p1', 'right']])
})

test('LobbyScreen disables Start Game and the option selects once the game has left the Lobby stage', () => {
  const lobby = buildLobbyProps({ ownerSession: { ownerPlayerId: 'p1', game: { phase: { stage: 'Bidding' } } } })
  render(<LobbyScreen lobby={lobby} />)

  assert.equal(screen.getByRole('button', { name: 'Start Game' }).disabled, true)
  assert.equal(screen.getByRole('combobox', { name: 'Select max cards' }).disabled, true)
  assert.equal(screen.getByRole('combobox', { name: 'Select AI difficulty' }).disabled, true)
})

const buildHomeProps = (overrides = {}) => ({
  isStagingBuild: false,
  buildTimestampLabel: '',
  requestError: '',
  sessionInfo: null,
  canInstallApp: false,
  promptToInstall: async () => {},
  openHelp: () => {},
  openCreateGame: () => {},
  openJoinGame: () => {},
  DownloadIcon: Icon,
  HelpIcon: Icon,
  ...overrides,
})

test('HomeScreen renders the primary actions and hides staging/session messaging by default', () => {
  render(<HomeScreen home={buildHomeProps()} />)

  assert.ok(screen.getByRole('button', { name: 'New Game' }))
  assert.ok(screen.getByRole('button', { name: 'Join Game' }))
  assert.equal(screen.queryByText(/Build: Staging/), null)
  assert.equal(screen.queryByLabelText('Install App'), null)
})

test('HomeScreen shows the staging badge, request error, and session info when provided', () => {
  const home = buildHomeProps({
    isStagingBuild: true,
    buildTimestampLabel: '2026-01-01 00:00 ET',
    requestError: 'You were removed.',
    sessionInfo: { action: 'createGame', gameId: 'brave-otter' },
  })
  render(<HomeScreen home={home} />)

  assert.ok(screen.getByText(/Build: Staging/))
  assert.ok(screen.getByText('You were removed.'))
  assert.ok(screen.getByText(/Game created/))
  assert.ok(screen.getByText(/brave-otter/))
})

test('HomeScreen shows the install button when installable and triggers the install prompt', () => {
  const calls = []
  const home = buildHomeProps({ canInstallApp: true, promptToInstall: async () => calls.push('install') })
  render(<HomeScreen home={home} />)

  fireEvent.click(screen.getByRole('button', { name: 'Install App' }))
  assert.deepEqual(calls, ['install'])
})

test('HomeScreen wires up create, join, and help actions', () => {
  const calls = []
  const home = buildHomeProps({
    openCreateGame: () => calls.push('create'),
    openJoinGame: () => calls.push('join'),
    openHelp: () => calls.push('help'),
  })
  render(<HomeScreen home={home} />)

  fireEvent.click(screen.getByRole('button', { name: 'New Game' }))
  fireEvent.click(screen.getByRole('button', { name: 'Join Game' }))
  fireEvent.click(screen.getByRole('button', { name: 'Help' }))

  assert.deepEqual(calls, ['create', 'join', 'help'])
})
