import { useEffect, useMemo, useState } from 'react'
import {
  checkState,
  createGame,
  getGameState,
  joinGame,
  movePlayer,
  removePlayer,
  startGame,
} from './api/lambdaClient'

const getPlayerName = (game, playerId) =>
  game?.players?.find((player) => player.id === playerId)?.name ?? 'Unknown'

const getViewerHand = (game) => {
  if (!game?.phase || !('cards' in game.phase)) {
    return null
  }

  return game.phase.cards.hands?.[0] ?? null
}

function GameTablePage({ game }) {
  const viewerHand = getViewerHand(game)
  const viewerPlayerId = viewerHand?.playerId
  const currentTurnPlayerId = game?.phase && 'turnPlayerId' in game.phase ? game.phase.turnPlayerId : undefined
  const currentRound = game?.phase && 'roundIndex' in game.phase ? game.phase.roundIndex + 1 : 1
  const totalRounds = game?.options?.rounds?.length ?? 0
  const bids = game?.phase && 'bids' in game.phase ? game.phase.bids : []
  const highestBid = bids.length ? Math.max(...bids.map((bid) => bid.amount)) : null
  const currentTrick = game?.phase && 'cards' in game.phase ? game.phase.cards.currentTrick : undefined

  const isViewerTurn = Boolean(viewerPlayerId && currentTurnPlayerId && viewerPlayerId === currentTurnPlayerId)

  const availableActions = (() => {
    switch (game.phase?.stage) {
      case 'Dealing':
        return isViewerTurn ? ['Deal Cards'] : ['Waiting for dealer']
      case 'Bidding':
        return isViewerTurn ? ['Submit Bid'] : ['Waiting for turn to bid']
      case 'Playing':
        return isViewerTurn ? ['Play Card'] : ['Waiting for turn to play']
      case 'Scoring':
        return ['Waiting for scoring to complete']
      case 'GameOver':
        return ['Game is over']
      default:
        return []
    }
  })()

  return (
    <main className="h-screen overflow-hidden bg-slate-950 px-3 py-3 text-slate-100">
      <section className="mx-auto flex h-full w-full max-w-6xl flex-col gap-3">
        <article className="shrink-0 rounded-lg border border-slate-700 bg-slate-900/60 p-4">
          <div className="grid grid-cols-1 gap-2 text-sm text-slate-200 sm:grid-cols-3 sm:items-center">
            <p className="sm:justify-self-start">Round: {currentRound} of {totalRounds || '?'}</p>
            <p className="sm:justify-self-center">Phase: {game.phase?.stage}</p>
            <p className="sm:justify-self-end">
              {currentTurnPlayerId ? `${getPlayerName(game, currentTurnPlayerId)}'s Turn` : "N/A's Turn"}
            </p>
          </div>
        </article>

        <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[30%_1fr]">
          <article className="min-h-0 overflow-auto rounded-lg border border-slate-700 bg-slate-900/60 p-4">
            <h2 className="text-lg font-semibold">Score</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {(game.players ?? []).map((player) => {
                const score = game.scores?.find((entry) => entry.playerId === player.id)
                return (
                  <li key={player.id} className="flex items-center justify-between rounded border border-slate-700 px-3 py-2 text-sm">
                    <span>{player.name}</span>
                    <span>{score?.total ?? 0}</span>
                  </li>
                )
              })}
            </ul>
            <p className="mt-4 text-sm text-slate-300">
              Current bid: {highestBid ?? 'No bids yet'}
            </p>
          </article>

          <article className="min-h-0 overflow-auto rounded-lg border border-slate-700 bg-slate-900/60 p-4">
            <h2 className="text-lg font-semibold">Table</h2>
            <p className="mt-2 text-sm text-slate-300">Current trick</p>
            <ul className="mt-2 flex flex-col gap-2">
              {(currentTrick?.plays ?? []).length > 0 ? (
                currentTrick.plays.map((play, index) => (
                  <li key={`${play.playerId}-${index}`} className="flex items-center justify-between rounded border border-slate-700 px-3 py-2 text-sm">
                    <span>{getPlayerName(game, play.playerId)}</span>
                    <span>{play.card.rank} {play.card.suit}</span>
                  </li>
                ))
              ) : (
                <li className="text-sm text-slate-400">No cards played in this trick yet.</li>
              )}
            </ul>
          </article>
        </div>

        <article className="min-h-0 shrink-0 basis-[34%] overflow-auto rounded-lg border border-slate-700 bg-slate-900/60 p-4">
          <h2 className="text-lg font-semibold">Player</h2>
          <p className="mt-2 text-sm text-slate-300">Your hand</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(viewerHand?.cards ?? []).length > 0 ? (
              viewerHand.cards.map((card, index) => (
                <span key={`${card.rank}-${card.suit}-${index}`} className="rounded border border-slate-600 px-2 py-1 text-sm">
                  {card.rank} {card.suit}
                </span>
              ))
            ) : (
              <p className="text-sm text-slate-400">No cards in hand yet.</p>
            )}
          </div>
          <p className="mt-4 text-sm text-slate-300">Available actions</p>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-slate-200">
            {availableActions.length > 0 ? (
              availableActions.map((action) => <li key={action}>{action}</li>)
            ) : (
              <li>No actions available.</li>
            )}
          </ul>
        </article>
      </section>
    </main>
  )
}

export default function App() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false)
  const [playerName, setPlayerName] = useState('')
  const [maxCards, setMaxCards] = useState('10')
  const [joinGameId, setJoinGameId] = useState('')
  const [joinPlayerName, setJoinPlayerName] = useState('')
  const [createErrors, setCreateErrors] = useState({})
  const [joinErrors, setJoinErrors] = useState({})
  const [isCreatingGame, setIsCreatingGame] = useState(false)
  const [isJoiningGame, setIsJoiningGame] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [sessionInfo, setSessionInfo] = useState(null)

  const [ownerSession, setOwnerSession] = useState(null)
  const [playerSession, setPlayerSession] = useState(null)
  const [lobbyError, setLobbyError] = useState('')
  const [lobbyInfo, setLobbyInfo] = useState('')
  const [isStartingGame, setIsStartingGame] = useState(false)
  const [pendingPlayerActionId, setPendingPlayerActionId] = useState('')
  const [selectedDealerPlayerId, setSelectedDealerPlayerId] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const gameIdFromUrl = new URL(window.location.href).searchParams.get('gameId')?.trim()
    if (!gameIdFromUrl) {
      return
    }

    setJoinGameId(gameIdFromUrl)
    setIsJoinModalOpen(true)
  }, [])

  const closeCreateModal = () => {
    setIsCreateModalOpen(false)
    setPlayerName('')
    setMaxCards('10')
    setCreateErrors({})
  }

  const closeJoinModal = () => {
    setIsJoinModalOpen(false)
    setJoinGameId('')
    setJoinPlayerName('')
    setJoinErrors({})
  }

  const handleCreateGame = async (event) => {
    event.preventDefault()
    const errors = {}

    if (!playerName.trim()) {
      errors.playerName = 'Player Name is required.'
    }

    if (!maxCards) {
      errors.maxCards = 'Max Cards is required.'
    }

    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors)
      return
    }

    setCreateErrors({})
    setRequestError('')
    setIsCreatingGame(true)

    try {
      const result = await createGame({
        playerName: playerName.trim(),
        maxCards: Number(maxCards),
      })
      setSessionInfo({
        action: 'createGame',
        gameId: result?.game?.id,
        playerToken: result?.playerToken,
      })

      setOwnerSession({
        gameId: result?.game?.id,
        playerToken: result?.playerToken,
        game: result?.game,
        ownerPlayerId: result?.game?.players?.find((player) => player.type === 'human')?.id,
      })
      setSelectedDealerPlayerId(
        result?.game?.players?.find((player) => player.type === 'human')?.id ?? '',
      )
      setPlayerSession(null)
      setLobbyError('')
      setLobbyInfo('')
      closeCreateModal()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create game'
      setRequestError(message)
    } finally {
      setIsCreatingGame(false)
    }
  }

  const handleJoinGame = async (event) => {
    event.preventDefault()
    const errors = {}

    if (!joinGameId.trim()) {
      errors.gameId = 'Game ID is required.'
    }

    if (!joinPlayerName.trim()) {
      errors.playerName = 'Player Name is required.'
    }

    if (Object.keys(errors).length > 0) {
      setJoinErrors(errors)
      return
    }

    setJoinErrors({})
    setRequestError('')
    setIsJoiningGame(true)

    try {
      const result = await joinGame({
        gameId: joinGameId.trim(),
        playerName: joinPlayerName.trim(),
      })
      setSessionInfo({
        action: 'joinGame',
        gameId: result?.game?.id,
        playerToken: result?.playerToken,
      })
      setPlayerSession({
        gameId: result?.game?.id,
        playerToken: result?.playerToken,
        game: result?.game,
        version: result?.version ?? result?.game?.version ?? 0,
      })
      setOwnerSession(null)
      setLobbyError('')
      setLobbyInfo('')
      closeJoinModal()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to join game'
      if (message.toLowerCase().includes('game not found')) {
        setJoinErrors((prev) => ({ ...prev, gameId: 'Game ID does not exist.' }))
        setRequestError('')
      } else {
        setRequestError(message)
      }
    } finally {
      setIsJoiningGame(false)
    }
  }

  const refreshOwnerGame = async () => {
    if (!ownerSession?.gameId || !ownerSession?.playerToken) {
      return
    }

    try {
      const result = await checkState({
        gameId: ownerSession.gameId,
        playerToken: ownerSession.playerToken,
      })

      setOwnerSession((prev) => {
        if (!prev) {
          return prev
        }

        return {
          ...prev,
          game: result?.game ?? prev.game,
        }
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to refresh game state'
      setLobbyError(message)
    }
  }

  const refreshPlayerGame = async () => {
    if (!playerSession?.gameId || !playerSession?.playerToken) {
      return
    }

    try {
      const result = await getGameState({
        gameId: playerSession.gameId,
        playerToken: playerSession.playerToken,
        version: playerSession.version ?? playerSession.game?.version ?? 0,
      })

      setPlayerSession((prev) => {
        if (!prev) {
          return prev
        }

        return {
          ...prev,
          game: result?.game ?? prev.game,
          version: result?.version ?? prev.version,
        }
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to refresh game state'
      setLobbyError(message)
    }
  }

  useEffect(() => {
    if (!ownerSession?.gameId || !ownerSession?.playerToken) {
      return undefined
    }

    refreshOwnerGame()

    const interval = setInterval(() => {
      refreshOwnerGame()
    }, 5000)

    return () => clearInterval(interval)
  }, [ownerSession?.gameId, ownerSession?.playerToken])

  useEffect(() => {
    if (!ownerSession?.ownerPlayerId) {
      return
    }

    if (!selectedDealerPlayerId) {
      setSelectedDealerPlayerId(ownerSession.ownerPlayerId)
    }
  }, [ownerSession?.ownerPlayerId, selectedDealerPlayerId])

  useEffect(() => {
    if (!playerSession?.gameId || !playerSession?.playerToken) {
      return undefined
    }

    refreshPlayerGame()

    const interval = setInterval(() => {
      refreshPlayerGame()
    }, 5000)

    return () => clearInterval(interval)
  }, [playerSession?.gameId, playerSession?.playerToken, playerSession?.version])

  const activeLobbySession = ownerSession ?? playerSession
  const isOwnerLobby = Boolean(ownerSession)
  const activeGame = activeLobbySession?.game

  const orderedPlayers = useMemo(() => {
    const game = activeLobbySession?.game
    if (!game) {
      return []
    }

    const playersById = new Map((game.players ?? []).map((player) => [player.id, player]))
    return (game.playerOrder ?? [])
      .map((playerId) => playersById.get(playerId))
      .filter(Boolean)
  }, [activeLobbySession?.game])

  const shareLink = useMemo(() => {
    if (!activeLobbySession?.gameId || typeof window === 'undefined') {
      return ''
    }

    const url = new URL(window.location.href)
    url.searchParams.set('gameId', activeLobbySession.gameId)
    return url.toString()
  }, [activeLobbySession?.gameId])

  const handleCopyShareLink = async () => {
    if (!shareLink) {
      return
    }

    try {
      await navigator.clipboard.writeText(shareLink)
      setLobbyInfo('Share link copied.')
    } catch {
      setLobbyInfo('Unable to copy automatically. Copy the link manually.')
    }
  }

  const handleMovePlayer = async (playerId, direction) => {
    if (!ownerSession?.gameId || !ownerSession?.playerToken) {
      return
    }

    setLobbyError('')
    setLobbyInfo('')
    setPendingPlayerActionId(playerId)

    try {
      const result = await movePlayer({
        gameId: ownerSession.gameId,
        playerToken: ownerSession.playerToken,
        playerId,
        direction,
      })
      setOwnerSession((prev) =>
        prev
          ? {
              ...prev,
              game: result?.game ?? prev.game,
            }
          : prev,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to move player'
      setLobbyError(message)
    } finally {
      setPendingPlayerActionId('')
    }
  }

  const handleRemovePlayer = async (playerId) => {
    if (!ownerSession?.gameId || !ownerSession?.playerToken) {
      return
    }

    setLobbyError('')
    setLobbyInfo('')
    setPendingPlayerActionId(playerId)

    try {
      const result = await removePlayer({
        gameId: ownerSession.gameId,
        playerToken: ownerSession.playerToken,
        playerId,
      })
      setOwnerSession((prev) =>
        prev
          ? {
              ...prev,
              game: result?.game ?? prev.game,
            }
          : prev,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to remove player'
      setLobbyError(message)
    } finally {
      setPendingPlayerActionId('')
    }
  }

  const handleStartGame = async () => {
    if (!ownerSession?.gameId || !ownerSession?.playerToken) {
      return
    }

    setLobbyError('')
    setLobbyInfo('')
    setIsStartingGame(true)

    try {
      const result = await startGame({
        gameId: ownerSession.gameId,
        playerToken: ownerSession.playerToken,
        dealerPlayerId: selectedDealerPlayerId || undefined,
      })
      setOwnerSession((prev) =>
        prev
          ? {
              ...prev,
              game: result?.game ?? prev.game,
            }
          : prev,
      )
      setLobbyInfo('Game started.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start game'
      setLobbyError(message)
    } finally {
      setIsStartingGame(false)
    }
  }

  const currentDealerPlayerId = ownerSession?.game?.phase?.dealerPlayerId ?? selectedDealerPlayerId

  if (activeGame && activeGame.phase?.stage !== 'Lobby') {
    return <GameTablePage game={activeGame} />
  }

  if (activeLobbySession?.gameId && activeLobbySession?.game) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
        <section className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          <header className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight">
              {isOwnerLobby ? 'Game Owner Lobby' : 'Game Lobby'}
            </h1>
            <p className="text-slate-300">Game ID: {activeLobbySession.gameId}</p>
            <p className="text-slate-300">Phase: {activeLobbySession.game.phase?.stage}</p>
          </header>

          {lobbyError && (
            <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {lobbyError}
            </p>
          )}
          {lobbyInfo && (
            <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {lobbyInfo}
            </p>
          )}

          <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
            <h2 className="text-lg font-semibold">Share Link</h2>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                readOnly
                value={shareLink}
                className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              />
              <button
                type="button"
                className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-200"
                onClick={handleCopyShareLink}
              >
                Copy Link
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">Players</h2>
              {isOwnerLobby && (
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <span>Dealer</span>
                  <select
                    value={selectedDealerPlayerId}
                    onChange={(event) => setSelectedDealerPlayerId(event.target.value)}
                    disabled={isStartingGame || ownerSession.game.phase?.stage !== 'Lobby'}
                    className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 disabled:opacity-50"
                    aria-label="Select dealer"
                  >
                    {orderedPlayers.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              {orderedPlayers.map((player) => {
                const isPending = pendingPlayerActionId === player.id
                return (
                  <li
                    key={player.id}
                    className={`rounded-md border border-slate-700 bg-slate-900 px-3 py-3 ${
                      isOwnerLobby
                        ? 'grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center'
                        : 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{player.name}</span>
                      <span className="rounded border border-slate-500 px-2 py-0.5 text-xs uppercase tracking-wide text-slate-300">
                        {player.type}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {isOwnerLobby && (
                        <>
                          <button
                            type="button"
                            className="rounded-md border border-slate-500 px-3 py-1.5 text-xl font-black hover:bg-slate-800 disabled:opacity-50"
                            onClick={() => handleMovePlayer(player.id, 'left')}
                            disabled={isPending || isStartingGame}
                            aria-label={`Move ${player.name} up`}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-slate-500 px-3 py-1.5 text-xl font-black hover:bg-slate-800 disabled:opacity-50"
                            onClick={() => handleMovePlayer(player.id, 'right')}
                            disabled={isPending || isStartingGame}
                            aria-label={`Move ${player.name} down`}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-red-500/50 px-3 py-1.5 text-xl font-black text-red-200 hover:bg-red-900/30 disabled:opacity-50"
                            onClick={() => handleRemovePlayer(player.id)}
                            disabled={
                              player.type === 'ai' ||
                              player.id === ownerSession?.ownerPlayerId ||
                              isPending ||
                              isStartingGame
                            }
                            aria-label={`Remove ${player.name}`}
                          >
                            ×
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>

          <div className="flex justify-end">
            {isOwnerLobby ? (
              <button
                type="button"
                className="rounded-md bg-slate-100 px-4 py-2 font-medium text-slate-900 hover:bg-slate-200 disabled:opacity-50"
                onClick={handleStartGame}
                disabled={isStartingGame || ownerSession.game.phase?.stage !== 'Lobby'}
              >
                {isStartingGame ? 'Starting...' : 'Start Game'}
              </button>
            ) : (
              <p className="text-sm text-slate-300">Waiting for game to start...</p>
            )}
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Setback</h1>
        {requestError && (
          <p className="w-full max-w-md rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {requestError}
          </p>
        )}
        {sessionInfo && (
          <p className="w-full max-w-md rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            {sessionInfo.action === 'createGame' ? 'Game created' : 'Joined game'}: {sessionInfo.gameId}
          </p>
        )}
        <div className="flex w-full max-w-xs flex-col gap-3">
          <button
            type="button"
            className="rounded-md bg-slate-100 px-4 py-2 font-medium text-slate-900 transition hover:bg-slate-200"
            onClick={() => setIsCreateModalOpen(true)}
          >
            New Game
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-500 px-4 py-2 font-medium text-slate-100 transition hover:bg-slate-800"
            onClick={() => setIsJoinModalOpen(true)}
          >
            Join Game
          </button>
        </div>
      </section>

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-lg bg-slate-900 p-6 text-left shadow-xl">
            <h2 className="text-xl font-semibold">Create Game</h2>
            <form className="mt-4 flex flex-col gap-4" onSubmit={handleCreateGame}>
              <label className="flex flex-col gap-2">
                <span className="text-sm text-slate-300">Player Name</span>
                <input
                  type="text"
                  value={playerName}
                  onChange={(event) => {
                    setPlayerName(event.target.value)
                    setCreateErrors((prev) => ({ ...prev, playerName: undefined }))
                  }}
                  className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-0 placeholder:text-slate-400 focus:border-slate-400"
                  placeholder="Enter your name"
                />
                {createErrors.playerName && (
                  <span className="text-sm text-red-300">{createErrors.playerName}</span>
                )}
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm text-slate-300">Max Cards</span>
                <select
                  value={maxCards}
                  onChange={(event) => {
                    setMaxCards(event.target.value)
                    setCreateErrors((prev) => ({ ...prev, maxCards: undefined }))
                  }}
                  className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-0 focus:border-slate-400"
                >
                  {Array.from({ length: 10 }, (_, index) => {
                    const value = String(10 - index)
                    return (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    )
                  })}
                </select>
                {createErrors.maxCards && (
                  <span className="text-sm text-red-300">{createErrors.maxCards}</span>
                )}
              </label>

              <div className="mt-2 flex justify-end gap-3">
                <button
                  type="button"
                  className="rounded-md border border-slate-500 px-4 py-2 font-medium text-slate-100 transition hover:bg-slate-800"
                  onClick={closeCreateModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingGame}
                  className="rounded-md bg-slate-100 px-4 py-2 font-medium text-slate-900 transition hover:bg-slate-200"
                >
                  {isCreatingGame ? 'Creating...' : 'Create Game'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isJoinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-lg bg-slate-900 p-6 text-left shadow-xl">
            <h2 className="text-xl font-semibold">Join Game</h2>
            <form className="mt-4 flex flex-col gap-4" onSubmit={handleJoinGame}>
              <label className="flex flex-col gap-2">
                <span className="text-sm text-slate-300">Game ID</span>
                <input
                  type="text"
                  value={joinGameId}
                  onChange={(event) => {
                    setJoinGameId(event.target.value)
                    setJoinErrors((prev) => ({ ...prev, gameId: undefined }))
                  }}
                  className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-0 placeholder:text-slate-400 focus:border-slate-400"
                  placeholder="Enter game ID"
                />
                {joinErrors.gameId && (
                  <span className="text-sm text-red-300">{joinErrors.gameId}</span>
                )}
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm text-slate-300">Player Name</span>
                <input
                  type="text"
                  value={joinPlayerName}
                  onChange={(event) => {
                    setJoinPlayerName(event.target.value)
                    setJoinErrors((prev) => ({ ...prev, playerName: undefined }))
                  }}
                  className="rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-0 placeholder:text-slate-400 focus:border-slate-400"
                  placeholder="Enter your name"
                />
                {joinErrors.playerName && (
                  <span className="text-sm text-red-300">{joinErrors.playerName}</span>
                )}
              </label>

              <div className="mt-2 flex justify-end gap-3">
                <button
                  type="button"
                  className="rounded-md border border-slate-500 px-4 py-2 font-medium text-slate-100 transition hover:bg-slate-800"
                  onClick={closeJoinModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isJoiningGame}
                  className="rounded-md bg-slate-100 px-4 py-2 font-medium text-slate-900 transition hover:bg-slate-200"
                >
                  {isJoiningGame ? 'Joining...' : 'Join Game'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
