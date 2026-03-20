export function ActiveGameScreen({
  gameTable,
  bidModal,
  endOfRoundModal,
  joinModal,
  awayContinueModal,
  helpModal,
}) {
  return (
    <>
      {gameTable}
      {bidModal}
      {endOfRoundModal}
      {joinModal}
      {awayContinueModal}
      {helpModal}
    </>
  )
}

export function LobbyScreen({ lobby, shareModal, removePlayerModal, removeSeatModal, renamePlayerModal, awayContinueModal, helpModal }) {
  const {
    activeLobbySession,
    gameError,
    lobbyInfo,
    orderedPlayers,
    currentDealerPlayerId,
    activeLobbyPlayerId,
    isOwnerLobby,
    ownerSession,
    isRenamingPlayer,
    isStartingGame,
    openLobbyRenamePlayerModal,
    pendingPlayerActionId,
    handleMovePlayer,
    openLobbyRemoveSeatConfirm,
    openLobbyRemovePlayerConfirm,
    handleAddSeat,
    maxSeats,
    maxCardsForLobbySeatCount,
    selectedMaxCards,
    setSelectedMaxCards,
    selectedAiDifficulty,
    setSelectedAiDifficulty,
    aiDifficultyOptions,
    resetActiveSessionState,
    handleStartGame,
    openShareModal,
    getPlayerPresence,
    ShareIcon,
  } = lobby

  return (
    <main className="theme-shell min-h-screen px-4 py-4 sm:py-6">
      <section className="mx-auto flex w-full max-w-5xl flex-col">
        <div className="table-surface rounded-[2rem] border px-4 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)] sm:px-6 sm:py-6">
          <header className="divider border-b pb-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h1 className="text-3xl font-bold tracking-tight">
                  Lobby
                </h1>
              </div>
              <button
                type="button"
                className="badge-subtle inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-muted transition hover:border-white/20 hover:text-white"
                onClick={openShareModal}
                aria-label={`Share game ${activeLobbySession.gameId}`}
                title="Share game"
              >
                <span className="text-accent font-medium [text-shadow:0_0_12px_rgba(158,211,180,0.35)]">
                  {activeLobbySession.gameId}
                </span>
                <ShareIcon className="h-5 w-5" />
              </button>
            </div>
          </header>

          <div className="mt-6 flex flex-col gap-6">
            {gameError ? (
              <p className="status-error">
                {gameError}
              </p>
            ) : null}
            {lobbyInfo ? (
              <p className="status-info">
                {lobbyInfo}
              </p>
            ) : null}

            <section className="lobby-panel rounded-2xl border p-4">
              <div className="divider flex items-center justify-between gap-4 border-b pb-3">
                <h2 className="text-lg font-semibold">{`Players (${orderedPlayers.length})`}</h2>
              </div>
              <ul className="mt-3 flex flex-col gap-2">
                {orderedPlayers.map((player) => {
                  const isPending = pendingPlayerActionId === player.id
                  const isDealer = player.id === currentDealerPlayerId
                  const isActiveLobbyPlayer = player.id === activeLobbyPlayerId
                  const isAway = player.type === 'human' && getPlayerPresence(player).away
                  const canRenamePlayer = isOwnerLobby || player.id === activeLobbyPlayerId

                  return (
                    <li
                      key={player.id}
                      className={`rounded-xl border px-3 py-3 ${
                        isActiveLobbyPlayer ? 'viewer-score-surface' : 'lobby-panel-strong'
                      } ${
                        isOwnerLobby
                          ? 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3'
                          : 'flex items-center justify-between gap-3'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {player.type === 'ai' ? (
                          <span aria-hidden="true" className="text-sm text-muted">🤖</span>
                        ) : (
                          <span aria-hidden="true" className="text-sm text-muted">👤</span>
                        )}
                        {canRenamePlayer ? (
                          <button
                            type="button"
                            className="truncate text-left font-medium text-white transition hover:[color:var(--accent-green-soft)] disabled:opacity-50"
                            onClick={() => openLobbyRenamePlayerModal(player)}
                            disabled={isRenamingPlayer || isPending || isStartingGame}
                            aria-label={`Rename ${player.name}`}
                            title={player.name}
                          >
                            {player.name}
                          </button>
                        ) : (
                          <span className="truncate font-medium">{player.name}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        {isAway ? (
                          <span className="badge-subtle-strong rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-dim">
                            Away
                          </span>
                        ) : null}
                        {isDealer ? (
                          <span className="badge-subtle-strong rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-dim">
                            Dealer
                          </span>
                        ) : null}
                        {isOwnerLobby ? (
                          <>
                            <div className="-my-2 flex w-10 self-stretch flex-col overflow-hidden rounded-md border border-white/10 bg-black/15">
                              <button
                                type="button"
                                className="flex min-h-0 flex-1 items-center justify-center rounded-none text-white/80 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
                                onClick={() => handleMovePlayer(player.id, 'left')}
                                disabled={isPending || isStartingGame}
                                aria-label={`Move ${player.name} up`}
                              >
                                <span
                                  aria-hidden="true"
                                  className="block h-2.5 w-2.5 translate-y-0.5 rotate-45 border-l-2 border-t-2 border-current"
                                />
                              </button>
                              <button
                                type="button"
                                className="flex min-h-0 flex-1 items-center justify-center rounded-none border-t border-white/10 text-white/80 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
                                onClick={() => handleMovePlayer(player.id, 'right')}
                                disabled={isPending || isStartingGame}
                                aria-label={`Move ${player.name} down`}
                              >
                                <span
                                  aria-hidden="true"
                                  className="block h-2.5 w-2.5 -translate-y-0.5 -rotate-[135deg] border-l-2 border-t-2 border-current"
                                />
                              </button>
                            </div>
                            <button
                              type="button"
                              className="btn-danger btn-danger-soft px-3 py-1.5 text-xl font-black disabled:opacity-50"
                              onClick={() => {
                                if (player.type === 'ai') {
                                  openLobbyRemoveSeatConfirm(player)
                                  return
                                }

                                openLobbyRemovePlayerConfirm(player)
                              }}
                              disabled={
                                (player.type === 'human' && player.id === ownerSession?.ownerPlayerId) ||
                                (player.type === 'ai' && orderedPlayers.length <= 2) ||
                                isPending ||
                                isStartingGame
                              }
                              aria-label={`Remove ${player.name}`}
                            >
                              ×
                            </button>
                          </>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
              {isOwnerLobby ? (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    className="btn-secondary px-4 py-2 text-sm disabled:opacity-50"
                    onClick={handleAddSeat}
                    disabled={pendingPlayerActionId === 'add-seat' || isStartingGame || orderedPlayers.length >= maxSeats}
                  >
                    {pendingPlayerActionId === 'add-seat' ? 'Adding...' : 'Add Seat'}
                  </button>
                </div>
              ) : null}
            </section>

            {isOwnerLobby ? (
              <section className="lobby-panel rounded-2xl border p-4">
                <div className="flex flex-col gap-3">
                  <div className="divider border-b pb-3">
                    <h2 className="text-lg font-semibold">Options</h2>
                  </div>
                  <p className="text-sm text-muted">
                    {`${orderedPlayers.length} seats. Max Cards available: ${maxCardsForLobbySeatCount}.`}
                  </p>
                  <label className="flex items-center justify-end gap-2 text-sm text-muted">
                    <span>Max Cards</span>
                    <select
                      value={selectedMaxCards}
                      onChange={(event) => setSelectedMaxCards(event.target.value)}
                      disabled={isStartingGame || ownerSession.game.phase?.stage !== 'Lobby'}
                      className="input-surface px-3 py-1.5 text-sm disabled:opacity-50"
                      aria-label="Select max cards"
                    >
                      {Array.from({ length: maxCardsForLobbySeatCount }, (_, index) => {
                        const value = String(maxCardsForLobbySeatCount - index)
                        return (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        )
                      })}
                    </select>
                  </label>
                  <label className="flex items-center justify-end gap-2 text-sm text-muted">
                    <span>AI Difficulty</span>
                    <select
                      value={selectedAiDifficulty}
                      onChange={(event) => setSelectedAiDifficulty(event.target.value)}
                      disabled={isStartingGame || ownerSession.game.phase?.stage !== 'Lobby'}
                      className="input-surface px-3 py-1.5 text-sm capitalize disabled:opacity-50"
                      aria-label="Select AI difficulty"
                    >
                      {aiDifficultyOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                className="btn-secondary px-4 py-2"
                onClick={resetActiveSessionState}
              >
                Back
              </button>
              {isOwnerLobby ? (
                <button
                  type="button"
                  className="btn-primary px-4 py-2 disabled:opacity-50"
                  onClick={handleStartGame}
                  disabled={isStartingGame || ownerSession.game.phase?.stage !== 'Lobby'}
                >
                  {isStartingGame ? 'Starting...' : 'Start Game'}
                </button>
              ) : (
                <p className="badge-subtle rounded-full border px-3 py-1 text-sm text-muted">
                  Waiting for game to start...
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
      {shareModal}
      {removePlayerModal}
      {removeSeatModal}
      {renamePlayerModal}
      {awayContinueModal}
      {helpModal}
    </main>
  )
}

export function HomeScreen({ home, createGameModal, joinGameModal, helpModal }) {
  const {
    isStagingBuild,
    buildTimestampLabel,
    requestError,
    sessionInfo,
    canInstallApp,
    promptToInstall,
    openHelp,
    openCreateGame,
    openJoinGame,
    DownloadIcon,
    HelpIcon,
  } = home

  return (
    <main className="theme-shell h-[100dvh] overflow-hidden px-4 py-4">
      {isStagingBuild ? (
        <p className="build-badge fixed left-4 top-4 z-10 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em]">
          Build: Staging {buildTimestampLabel}
        </p>
      ) : null}
      <section className="mx-auto flex h-full max-w-xl flex-col items-center justify-center px-2 py-4 text-center sm:py-6">
        <div className="table-surface flex max-h-full w-full flex-col items-center justify-center overflow-hidden rounded-[2rem] border px-6 pb-8 pt-5 sm:pb-10 sm:pt-6 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
          <img
            src="/logo-512x512.png"
            alt="Setback"
            className="mb-4 h-24 w-24 rounded-xl sm:h-28 sm:w-28"
          />
          {requestError ? (
            <p className="status-error mb-4 w-full max-w-md">
              {requestError}
            </p>
          ) : null}
          {sessionInfo ? (
            <p className="status-info mb-4 w-full max-w-md">
              {sessionInfo.action === 'createGame' ? 'Game created' : 'Joined game'}: {sessionInfo.gameId}
            </p>
          ) : null}
          <div className="flex w-full max-w-xs flex-col gap-3">
            <button
              type="button"
              className="btn-primary px-4 py-2"
              onClick={openCreateGame}
            >
              New Game
            </button>
            <button
              type="button"
              className="btn-secondary px-4 py-2"
              onClick={openJoinGame}
            >
              Join Game
            </button>
            <div className="mt-1 border-t border-[color:var(--border-color)] pt-3">
              <div className="flex justify-end gap-2">
                {canInstallApp ? (
                  <button
                    type="button"
                    className="btn-secondary btn-install inline-flex h-10 w-10 items-center justify-center p-0"
                    aria-label="Install App"
                    title="Install App"
                    onClick={() => {
                      void promptToInstall()
                    }}
                  >
                    <DownloadIcon className="h-[1.5625rem] w-[1.5625rem]" />
                  </button>
                ) : null}
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[color:var(--accent-blue)] bg-[rgba(47,111,219,0.12)] p-0 text-[color:var(--accent-blue-soft)] transition hover:bg-[rgba(47,111,219,0.2)]"
                  aria-label="Help"
                  title="Help"
                  onClick={openHelp}
                >
                  <HelpIcon className="h-[1.5625rem] w-[1.5625rem]" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {createGameModal}
      {joinGameModal}
      {helpModal}
    </main>
  )
}
