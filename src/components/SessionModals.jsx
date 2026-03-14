import { MAX_PLAYER_NAME_LENGTH } from '../utils/playerName'

export function CreateGameModal({
  isOpen,
  playerName,
  playerNameError,
  isCreatingGame,
  onClose,
  onSubmit,
  onPlayerNameChange,
}) {
  if (!isOpen) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 px-4 py-4"
      onClick={onClose}
    >
      <div
        className="dialog-surface max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-6 text-left"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-xl font-semibold">Create Game</h2>
        <form className="mt-4 flex flex-col gap-4" onSubmit={onSubmit}>
          <label className="flex flex-col gap-2">
            <span className="text-sm text-muted">Player Name</span>
            <input
              type="text"
              value={playerName}
              onChange={onPlayerNameChange}
              className="input-surface"
              placeholder="Enter your name"
              maxLength={MAX_PLAYER_NAME_LENGTH}
            />
            {playerNameError ? <span className="text-sm text-red-300">{playerNameError}</span> : null}
          </label>

          <div className="mt-2 flex justify-end gap-3">
            <button
              type="button"
              className="btn-secondary px-4 py-2"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreatingGame}
              className="btn-primary px-4 py-2"
            >
              {isCreatingGame ? 'Creating...' : 'Create Game'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function JoinGameModal({
  isOpen,
  joinGameId,
  joinPlayerName,
  joinErrors,
  rejoinableGames,
  selectedRejoinGameId,
  isLoadingRejoinGames,
  isJoiningGame,
  isRejoiningGame,
  onClose,
  onSubmit,
  onJoinGameIdChange,
  onJoinPlayerNameChange,
  onSelectedRejoinGameIdChange,
}) {
  if (!isOpen) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 px-4 py-4"
      onClick={onClose}
    >
      <div
        className="dialog-surface max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-6 text-left"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-xl font-semibold">Join Game</h2>
        <form className="mt-4 flex flex-col gap-4" onSubmit={onSubmit}>
          <label className="flex flex-col gap-2">
            <span className="text-sm text-muted">Game ID</span>
            <input
              type="text"
              value={joinGameId}
              onChange={onJoinGameIdChange}
              className="input-surface disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Enter game ID"
              disabled={Boolean(selectedRejoinGameId)}
            />
            {joinErrors.gameId ? <span className="text-sm text-red-300">{joinErrors.gameId}</span> : null}
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm text-muted">Player Name</span>
            <input
              type="text"
              value={joinPlayerName}
              onChange={onJoinPlayerNameChange}
              className="input-surface disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Enter your name"
              maxLength={MAX_PLAYER_NAME_LENGTH}
              disabled={Boolean(selectedRejoinGameId)}
            />
            {joinErrors.playerName ? <span className="text-sm text-red-300">{joinErrors.playerName}</span> : null}
          </label>

          {rejoinableGames.length > 0 ? (
            <>
              <div className="divider relative my-1 border-t">
                <span className="divider-label text-accent absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 px-3 text-xs font-semibold uppercase tracking-[0.18em]">
                  OR
                </span>
              </div>

              <label className="flex flex-col gap-2">
                <span className="text-sm text-muted">Choose a Saved Session</span>
                <select
                  value={selectedRejoinGameId}
                  onChange={onSelectedRejoinGameIdChange}
                  className="input-surface"
                  disabled={isLoadingRejoinGames || isRejoiningGame}
                >
                  <option value=""></option>
                  {rejoinableGames.map((game) => (
                    <option key={game.gameId} value={game.gameId}>
                      {game.gameId} ({game.phase})
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          <div className="mt-2 flex justify-end gap-3">
            <button
              type="button"
              className="btn-secondary px-4 py-2"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isJoiningGame || isRejoiningGame}
              className="btn-primary px-4 py-2"
            >
              {selectedRejoinGameId
                ? isRejoiningGame
                  ? 'Rejoining...'
                  : 'Join Game'
                : isJoiningGame
                  ? 'Joining...'
                  : 'Join Game'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
