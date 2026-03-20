import { MAX_PLAYER_NAME_LENGTH } from '../utils/playerName'

export function CreateGameModal({ isOpen, form, onClose, onSubmit }) {
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
              value={form.playerName}
              onChange={form.onPlayerNameChange}
              className="input-surface"
              placeholder="Enter your name"
              maxLength={MAX_PLAYER_NAME_LENGTH}
            />
            {form.playerNameError ? <span className="text-sm text-red-300">{form.playerNameError}</span> : null}
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
              disabled={form.isCreatingGame}
              className="btn-primary px-4 py-2"
            >
              {form.isCreatingGame ? 'Creating...' : 'Create Game'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function JoinGameModal({ isOpen, form, onClose, onSubmit }) {
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
              value={form.joinGameId}
              onChange={form.onJoinGameIdChange}
              className="input-surface disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Enter game ID"
              disabled={Boolean(form.selectedRejoinGameId)}
            />
            {form.joinErrors.gameId ? <span className="text-sm text-red-300">{form.joinErrors.gameId}</span> : null}
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm text-muted">Player Name</span>
            <input
              type="text"
              value={form.joinPlayerName}
              onChange={form.onJoinPlayerNameChange}
              className="input-surface disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Enter your name"
              maxLength={MAX_PLAYER_NAME_LENGTH}
              disabled={Boolean(form.selectedRejoinGameId)}
            />
            {form.joinErrors.playerName ? <span className="text-sm text-red-300">{form.joinErrors.playerName}</span> : null}
          </label>

          {form.rejoinableGames.length > 0 ? (
            <>
              <div className="divider relative my-1 border-t">
                <span className="divider-label text-accent absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 px-3 text-xs font-semibold uppercase tracking-[0.18em]">
                  OR
                </span>
              </div>

              <label className="flex flex-col gap-2">
                <span className="text-sm text-muted">Continue a Saved Game</span>
                <select
                  value={form.selectedRejoinGameId}
                  onChange={form.onSelectedRejoinGameIdChange}
                  className="input-surface"
                  disabled={form.isLoadingRejoinGames || form.isRejoiningGame}
                >
                  <option value=""></option>
                  {form.rejoinableGames.map((game) => (
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
              disabled={form.isJoiningGame || form.isRejoiningGame}
              className="btn-primary px-4 py-2"
            >
              {form.selectedRejoinGameId
                ? form.isRejoiningGame
                  ? 'Rejoining...'
                  : 'Join Game'
                : form.isJoiningGame
                  ? 'Joining...'
                  : 'Join Game'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
