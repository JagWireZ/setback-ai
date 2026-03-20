import { ScoreHistory, ScoreSheet } from './Scoreboard'
import { MAX_PLAYER_NAME_LENGTH, sanitizePlayerNameInput, validatePlayerName } from '../utils/playerName'
import { getPlayerPresence } from '../utils/playerPresence'

const OWNER_IDLE_TURN_TIMEOUT_MS = 60_000

function ExitIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      <path d="M4.75 5.5h5v13h-5z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.75 5.5 14 7.25v9.5L9.75 18.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 12h7.25" strokeLinecap="round" />
      <path d="M16.25 8.75 19.5 12l-3.25 3.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ResetIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      <path d="M19 12a7 7 0 1 1-2.05-4.95" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 5.75v4.5h-4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ModalShell({ children, className = 'max-w-md', onClick, onClose, overlayClassName = 'bg-black/70' }) {
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center overflow-y-auto ${overlayClassName} px-4 py-4`}
      onClick={onClose}
    >
      <div
        className={`dialog-surface max-h-[calc(100dvh-2rem)] w-full overflow-y-auto p-6 text-left ${className}`}
        onClick={(event) => {
          event.stopPropagation()
          onClick?.(event)
        }}
      >
        {children}
      </div>
    </div>
  )
}

function GameTableModals({
  DownloadIcon,
  HelpIcon,
  LinkIcon,
  ShareIcon,
  actualTurnPlayerId,
  bids,
  booksByPlayerId,
  canInstallApp,
  closeRemovePlayerConfirm,
  closeScorePlayerModal,
  currentPlayerName,
  currentRoundConfig,
  currentRoundIndex,
  editedPlayerName,
  game,
  isEditingPlayerName,
  isGameOver,
  isHistoryModalOpen,
  isJoinModalOpen,
  isLeavingGame,
  isLeaveConfirmModalOpen,
  isMenuModalOpen,
  isOwner,
  isRenamingPlayer,
  isResetConfirmModalOpen,
  isScoreModalOpen,
  isShareLinkCopied,
  isShareModalOpen,
  nowMs,
  onCopyShareLink,
  onCoverAwayPlayerTurn,
  onInstallApp,
  onLeaveGame,
  onOpenHelp,
  onGoHome,
  onRemovePlayer,
  onRenamePlayer,
  onSetGameError,
  onStartOver,
  openRemovePlayerConfirm,
  ownerPlayerId,
  pendingPlayerActionId,
  pendingRemovePlayer,
  scorePlayerNameDraft,
  selectedScorePlayer,
  selectedScorePlayerId,
  setEditedPlayerName,
  setIsEditingPlayerName,
  setIsHistoryModalOpen,
  setIsLeaveConfirmModalOpen,
  setIsMenuModalOpen,
  setIsResetConfirmModalOpen,
  setIsScoreModalOpen,
  setIsShareModalOpen,
  setScorePlayerNameDraft,
  setSelectedScorePlayerId,
  shareLink,
  shareQrCodeDataUrl,
  shortenedMenuPlayerName,
  viewerPlayerId,
}) {
  return (
    <>
      {isScoreModalOpen ? (
        <ModalShell className="max-w-md rounded-xl p-5" onClose={() => setIsScoreModalOpen(false)} overlayClassName="bg-black/60">
          <ScoreSheet
            title="Score"
            game={game}
            bids={bids}
            booksByPlayerId={booksByPlayerId}
            currentRoundIndex={currentRoundIndex}
            nowMs={nowMs}
            currentRoundConfig={currentRoundConfig}
            isGameOver={isGameOver}
            isOwner={isOwner}
            viewerPlayerId={viewerPlayerId}
            onSelectPlayer={(player) => setSelectedScorePlayerId(player.id)}
            onOpenHistory={() => setIsHistoryModalOpen(true)}
            onClose={() => setIsScoreModalOpen(false)}
          />
        </ModalShell>
      ) : null}

      {isHistoryModalOpen ? <ScoreHistory game={game} onClose={() => setIsHistoryModalOpen(false)} /> : null}

      {selectedScorePlayer ? (
        <ModalShell className="max-w-md" onClose={closeScorePlayerModal} overlayClassName="bg-black/60">
          {(() => {
            const selectedPlayerPresence = getPlayerPresence(selectedScorePlayer)
            const isSelectedPlayerAway = selectedScorePlayer.type === 'human' && selectedPlayerPresence.away
            const isSelectedPlayerTurn = selectedScorePlayer.id === actualTurnPlayerId
            const selectedPlayerIdleSince = Math.max(
              selectedPlayerPresence.lastSeenAt ?? 0,
              game.phase?.turnStartedAt ?? 0,
            )
            const isSelectedPlayerIdleOnTurn =
              selectedScorePlayer.type === 'human' &&
              !selectedPlayerPresence.away &&
              isSelectedPlayerTurn &&
              selectedPlayerIdleSince > 0 &&
              nowMs - selectedPlayerIdleSince >= OWNER_IDLE_TURN_TIMEOUT_MS
            const canCoverSelectedPlayerTurn =
              selectedScorePlayer.id !== ownerPlayerId &&
              ((isSelectedPlayerAway && isSelectedPlayerTurn) || isSelectedPlayerIdleOnTurn)

            return (
              <>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">Manage Player</h2>
                </div>
                <p className="mt-2 text-sm text-muted">
                  {selectedScorePlayer.name}
                  {isSelectedPlayerAway ? ' • Away' : ''}
                </p>
                {isSelectedPlayerIdleOnTurn ? (
                  <p className="status-info mt-4 text-sm">This player has been idle on their turn for at least 60 seconds.</p>
                ) : null}
                {isSelectedPlayerAway && isSelectedPlayerTurn ? (
                  <p className="status-info mt-4 text-sm">This player is away and it is currently their turn.</p>
                ) : null}
                <form
                  className="mt-4 flex flex-col gap-4"
                  onSubmit={async (event) => {
                    event.preventDefault()

                    const validationError = validatePlayerName(scorePlayerNameDraft)
                    if (validationError) {
                      onSetGameError(validationError)
                      return
                    }

                    const didRename = await onRenamePlayer?.(scorePlayerNameDraft.trim(), selectedScorePlayer.id)
                    if (didRename) {
                      closeScorePlayerModal()
                    }
                  }}
                >
                  <label className="flex flex-col gap-2">
                    <span className="text-sm text-muted">Player Name</span>
                    <input
                      type="text"
                      value={scorePlayerNameDraft}
                      onChange={(event) => {
                        setScorePlayerNameDraft(sanitizePlayerNameInput(event.target.value))
                        onSetGameError('')
                      }}
                      className="input-surface"
                      placeholder="Player name"
                      maxLength={MAX_PLAYER_NAME_LENGTH}
                      autoFocus
                    />
                  </label>
                  {canCoverSelectedPlayerTurn ? (
                    <button
                      type="button"
                      className="btn-primary px-4 py-2 disabled:opacity-50"
                      onClick={async () => {
                        onSetGameError('')
                        const didCover = await onCoverAwayPlayerTurn?.(selectedScorePlayer.id)
                        if (didCover) {
                          closeScorePlayerModal()
                        }
                      }}
                      disabled={pendingPlayerActionId === selectedScorePlayer.id || isRenamingPlayer}
                    >
                      {pendingPlayerActionId === selectedScorePlayer.id ? 'Playing...' : 'Let AI Play Turn'}
                    </button>
                  ) : null}
                  <div className="flex justify-between gap-3">
                    <button
                      type="button"
                      className="btn-danger btn-danger-soft px-4 py-2 disabled:opacity-50"
                      onClick={() => {
                        onSetGameError('')
                        openRemovePlayerConfirm(selectedScorePlayer)
                      }}
                      disabled={
                        isRenamingPlayer ||
                        pendingPlayerActionId === selectedScorePlayer.id ||
                        selectedScorePlayer.type === 'ai' ||
                        selectedScorePlayer.id === ownerPlayerId
                      }
                    >
                      {pendingPlayerActionId === selectedScorePlayer.id ? 'Removing...' : 'Remove Player'}
                    </button>
                    <div className="flex justify-end gap-3">
                      <button type="button" className="btn-secondary px-4 py-2" onClick={closeScorePlayerModal}>
                        Close
                      </button>
                      <button
                        type="submit"
                        className="btn-primary px-4 py-2 disabled:opacity-50"
                        disabled={isRenamingPlayer || !scorePlayerNameDraft.trim()}
                      >
                        {isRenamingPlayer ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                </form>
              </>
            )
          })()}
        </ModalShell>
      ) : null}

      {isMenuModalOpen && !isJoinModalOpen ? (
        <ModalShell className="max-w-sm" onClose={() => setIsMenuModalOpen(false)} overlayClassName="bg-black/60">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 w-full sm:w-auto">
              <button
                type="button"
                className="block w-full min-w-0 truncate text-left text-xl font-semibold text-white transition hover:[color:var(--accent-green-soft)] sm:max-w-[14rem]"
                onClick={() => {
                  setIsEditingPlayerName(true)
                  setEditedPlayerName(currentPlayerName)
                }}
                title={currentPlayerName}
              >
                {`👤 ${shortenedMenuPlayerName}`}
              </button>
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
              <button
                type="button"
                className="badge-subtle inline-flex w-full items-center justify-center gap-2 truncate rounded-full border px-3 py-1 text-sm font-medium text-muted transition hover:border-white/20 hover:text-white sm:w-auto"
                onClick={() => setIsShareModalOpen(true)}
                aria-label={`Share game ${game.id}`}
                title="Share game"
              >
                <span className="text-accent font-medium [text-shadow:0_0_12px_rgba(158,211,180,0.35)]">{game.id}</span>
                <ShareIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="divider mt-4 border-t" />
          {isEditingPlayerName ? (
            <form
              className="mt-4 flex flex-col gap-3"
              onSubmit={async (event) => {
                event.preventDefault()
                const nextName = editedPlayerName.trim()
                if (!nextName || nextName === currentPlayerName) {
                  setIsEditingPlayerName(false)
                  setEditedPlayerName(currentPlayerName)
                  return
                }

                const didRename = await onRenamePlayer?.(nextName)
                if (didRename) {
                  setIsEditingPlayerName(false)
                }
              }}
            >
              <input
                type="text"
                value={editedPlayerName}
                onChange={(event) => setEditedPlayerName(event.target.value)}
                className="input-surface"
                placeholder="Player name"
                maxLength={32}
                autoFocus
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="btn-secondary px-4 py-2"
                  onClick={() => {
                    setIsEditingPlayerName(false)
                    setEditedPlayerName(currentPlayerName)
                  }}
                  disabled={isRenamingPlayer}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary px-4 py-2 disabled:opacity-50"
                  disabled={isRenamingPlayer || !editedPlayerName.trim()}
                >
                  {isRenamingPlayer ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          ) : null}
          <div className="mt-4 flex flex-col items-center gap-3">
            {isOwner ? (
              <>
                <button
                  type="button"
                  className="inline-flex w-[90%] items-center justify-end gap-3 rounded-md border border-[color:var(--accent-blue)] bg-[rgba(47,111,219,0.12)] px-4 py-3 text-right font-medium text-[color:var(--accent-blue-soft)] transition hover:bg-[rgba(47,111,219,0.2)]"
                  onClick={() => {
                    setIsMenuModalOpen(false)
                    setIsResetConfirmModalOpen(true)
                  }}
                >
                  <span>Reset</span>
                  <ResetIcon className="h-6 w-6 shrink-0" />
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="btn-danger btn-danger-soft inline-flex w-[90%] items-center justify-end gap-3 px-4 py-3 text-right disabled:opacity-50"
              onClick={() => {
                setIsMenuModalOpen(false)
                setIsLeaveConfirmModalOpen(true)
              }}
              disabled={isLeavingGame}
            >
              <span>{isLeavingGame ? 'Leaving...' : 'Leave'}</span>
              <ExitIcon className="h-6 w-6 shrink-0" />
            </button>
          </div>
          <div className="mx-auto mt-5 flex w-[90%] items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[color:var(--accent-blue)] bg-[rgba(47,111,219,0.12)] p-0 text-[color:var(--accent-blue-soft)] transition hover:bg-[rgba(47,111,219,0.2)]"
                aria-label="Help"
                title="Help"
                onClick={() => {
                  setIsMenuModalOpen(false)
                  onOpenHelp?.()
                }}
              >
                <HelpIcon className="h-[1.5625rem] w-[1.5625rem]" />
              </button>
              {canInstallApp ? (
                <button
                  type="button"
                  className="btn-secondary btn-install inline-flex h-10 w-10 items-center justify-center p-0"
                  aria-label="Install App"
                  title="Install App"
                  onClick={async () => {
                    setIsMenuModalOpen(false)
                    await onInstallApp?.()
                  }}
                >
                  <DownloadIcon className="h-[1.5625rem] w-[1.5625rem]" />
                </button>
              ) : null}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                className="btn-secondary inline-flex h-10 items-center justify-center px-4 text-sm"
                onClick={() => setIsMenuModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {isShareModalOpen ? (
        <ModalShell className="max-w-md" onClose={() => setIsShareModalOpen(false)}>
          <div>
            <div>
              <h2 className="text-xl font-semibold text-white">Share Game</h2>
            </div>
            <div className="divider mt-3 border-t" />
          </div>
          <div className="mt-5 flex flex-col gap-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-dim">Game ID</p>
              <div className="mt-2 rounded-2xl border border-white/10 bg-black/15 px-4 py-3">
                <p className="text-center text-lg font-semibold text-white">{game.id}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-dim">Game URL</p>
              <button
                type="button"
                className="input-surface mt-2 flex w-full cursor-pointer items-center gap-2 truncate whitespace-nowrap text-left text-sm transition hover:border-white/20"
                onClick={onCopyShareLink}
                aria-label={isShareLinkCopied ? 'Share link copied' : 'Copy share link'}
                title={isShareLinkCopied ? 'Copied' : 'Copy link'}
              >
                <LinkIcon className="h-4 w-4 shrink-0 text-dim" />
                <span className="min-w-0 truncate">{isShareLinkCopied ? 'Copied!' : shareLink}</span>
              </button>
            </div>
            <div className="flex w-fit self-center flex-col items-center rounded-xl border border-white/10 bg-white/95 p-2">
              {shareQrCodeDataUrl ? (
                <img
                  src={shareQrCodeDataUrl}
                  alt={`QR code for joining game ${game.id}`}
                  className="h-48 w-48 max-w-full rounded-md"
                />
              ) : (
                <div className="flex h-48 w-48 max-w-full items-center justify-center rounded-md bg-slate-100 text-sm text-slate-500">
                  Generating QR code...
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <button type="button" className="btn-secondary px-3 py-1.5" onClick={() => setIsShareModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {isResetConfirmModalOpen ? (
        <ModalShell className="max-w-md" onClose={() => setIsResetConfirmModalOpen(false)}>
          <h2 className="text-xl font-semibold text-white">Reset Game?</h2>
          <p className="mt-3 text-sm text-muted">
            This will erase the current game progress, send everyone back to the lobby, and restart from round 1.
          </p>
          <p className="text-danger-soft mt-2 text-sm">This cannot be undone.</p>
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" className="btn-secondary px-4 py-2" onClick={() => setIsResetConfirmModalOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger btn-danger-soft px-4 py-2"
              onClick={() => {
                setIsResetConfirmModalOpen(false)
                onStartOver?.()
              }}
            >
              Reset Game
            </button>
          </div>
        </ModalShell>
      ) : null}

      {isLeaveConfirmModalOpen ? (
        <ModalShell className="max-w-md" onClose={() => setIsLeaveConfirmModalOpen(false)}>
          <h2 className="text-xl font-semibold text-white">Leave Game?</h2>
          <p className="mt-3 text-sm text-muted">
            {isOwner
              ? 'Leaving will end this game for everyone.'
              : 'You will be removed from this game.'}
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              className="btn-secondary px-4 py-2"
              onClick={() => setIsLeaveConfirmModalOpen(false)}
              disabled={isLeavingGame}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger btn-danger-soft px-4 py-2 disabled:opacity-50"
              onClick={async () => {
                setIsLeaveConfirmModalOpen(false)
                await onLeaveGame?.()
              }}
              disabled={isLeavingGame}
            >
              {isLeavingGame ? 'Leaving...' : 'Leave'}
            </button>
          </div>
        </ModalShell>
      ) : null}

      {pendingRemovePlayer ? (
        <ModalShell className="max-w-md" onClose={closeRemovePlayerConfirm}>
          <h2 className="text-xl font-semibold text-white">Remove Player?</h2>
          <p className="mt-3 text-sm text-muted">{`Remove ${pendingRemovePlayer.name} from this game?`}</p>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              className="btn-secondary px-4 py-2"
              onClick={closeRemovePlayerConfirm}
              disabled={pendingPlayerActionId === pendingRemovePlayer.id}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger btn-danger-soft px-4 py-2 disabled:opacity-50"
              onClick={async () => {
                const playerId = pendingRemovePlayer.id
                const didRemove = await onRemovePlayer?.(playerId)
                if (didRemove) {
                  if (selectedScorePlayerId === playerId) {
                    closeScorePlayerModal()
                  }
                  closeRemovePlayerConfirm()
                }
              }}
              disabled={pendingPlayerActionId === pendingRemovePlayer.id}
            >
              {pendingPlayerActionId === pendingRemovePlayer.id ? 'Removing...' : 'Remove Player'}
            </button>
          </div>
        </ModalShell>
      ) : null}
    </>
  )
}

export { GameTableModals }
