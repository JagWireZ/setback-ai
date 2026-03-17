import { getBidDisplay, getCompletedRoundCount, getPlayerName, getRoundDirectionArrow } from '../utils/gameUi'
import { getPlayerPresence } from '../utils/playerPresence'
import { truncateLabel } from '../utils/playerName'

export function ScoreSummary({
  game,
  bids,
  booksByPlayerId,
  currentRoundIndex,
  nowMs = Date.now(),
  isGameOver = false,
  isOwner = false,
  viewerPlayerId = '',
  onSelectPlayer,
}) {
  const playersById = new Map((game.players ?? []).map((player) => [player.id, player]))
  const orderedPlayers =
    (game.playerOrder ?? [])
      .map((playerId) => playersById.get(playerId))
      .filter(Boolean)
  const currentDealerPlayerId = game?.phase && 'dealerPlayerId' in game.phase ? game.phase.dealerPlayerId : ''
  const getPlayerRoleIcon = (player) => (player.type === 'ai' ? '🤖' : '👤')
  const highestTotalScore = Array.isArray(game.scores)
    ? game.scores.reduce((highest, entry) => Math.max(highest, entry?.total ?? Number.NEGATIVE_INFINITY), Number.NEGATIVE_INFINITY)
    : Number.NEGATIVE_INFINITY
  const displayedPlayers = orderedPlayers.length > 0 ? orderedPlayers : game.players ?? []
  const sortedPlayers = isGameOver
    ? [...displayedPlayers].sort((left, right) => {
        const leftScore = game.scores?.find((entry) => entry.playerId === left.id)?.total ?? 0
        const rightScore = game.scores?.find((entry) => entry.playerId === right.id)?.total ?? 0
        return rightScore - leftScore
      })
    : displayedPlayers

  return (
    <ul className="mt-3 flex flex-col gap-2">
      {sortedPlayers.map((player) => {
        const score = game.scores?.find((entry) => entry.playerId === player.id)
        const playerBidEntry = bids.find((bid) => bid.playerId === player.id)
        const playerBid =
          playerBidEntry?.trip === true
            ? 'T'
            : typeof playerBidEntry?.amount === 'number'
              ? playerBidEntry.amount
              : score?.rounds?.[currentRoundIndex]?.bid ?? '-'
        const playerBooks =
          booksByPlayerId.get(player.id) ?? score?.rounds?.[currentRoundIndex]?.books ?? 0
        const playerRainbow = score?.rounds?.[currentRoundIndex]?.rainbow === true
        const playerDisplayName = truncateLabel(player.name, 22)
        const isWinner = isGameOver && highestTotalScore !== Number.NEGATIVE_INFINITY && (score?.total ?? 0) === highestTotalScore
        const isViewerPlayer = Boolean(viewerPlayerId && player.id === viewerPlayerId)
        const canSelectPlayer = typeof onSelectPlayer === 'function' && (isOwner || isViewerPlayer)
        const playerPresence = getPlayerPresence(player)
        const isAway = player.type === 'human' && playerPresence.away
        const turnIdleSince = Math.max(playerPresence.lastSeenAt ?? 0, 'turnPlayerId' in (game.phase ?? {}) ? game.phase.turnStartedAt ?? 0 : 0)
        const isIdle =
          !isAway &&
          player.type === 'human' &&
          'turnPlayerId' in (game.phase ?? {}) &&
          game.phase.turnPlayerId === player.id &&
          turnIdleSince > 0 &&
          nowMs - turnIdleSince >= 60_000

        return (
          <li
            key={player.id}
            className={`rounded border px-3 py-2 text-sm ${
              isWinner
                ? 'winner-surface'
                : isViewerPlayer
                  ? 'viewer-score-surface'
                  : 'panel-surface-strong'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {canSelectPlayer ? (
                    <button
                      type="button"
                      className="block w-full min-w-0 cursor-pointer truncate text-left font-medium text-white transition hover:[color:var(--accent-green-soft)]"
                      title={player.name}
                      onClick={() => onSelectPlayer(player)}
                      aria-label={`${isOwner ? 'Manage' : 'Edit'} ${player.name}`}
                    >
                      {`${getPlayerRoleIcon(player)} ${playerDisplayName}`}
                    </button>
                  ) : (
                    <p className="truncate font-medium" title={player.name}>
                      {`${getPlayerRoleIcon(player)} ${playerDisplayName}`}
                    </p>
                  )}
                </div>
                {!isGameOver ? (
                  <div className="mt-1 flex items-center gap-1.5">
                    <p className="text-base font-semibold text-white">
                      {score?.total ?? 0}
                      {playerRainbow ? <span className="ml-1" aria-label="Rainbow round">🌈</span> : null}
                    </p>
                    {isAway ? (
                      <span className="badge-subtle rounded-full border px-2 py-0.5 align-middle text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-dim">
                        Away
                      </span>
                    ) : isIdle ? (
                      <span className="badge-subtle rounded-full border px-2 py-0.5 align-middle text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-dim">
                        Idle
                      </span>
                    ) : null}
                    {player.id === currentDealerPlayerId ? (
                      <span className="badge-subtle rounded-full border px-2 py-0.5 align-middle text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-dim">
                        Dealer
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {isGameOver ? (
                <p className="text-right text-lg font-semibold text-white">
                  {score?.total ?? 0}
                  {playerRainbow ? <span className="ml-2" aria-label="Rainbow round">🌈</span> : null}
                </p>
              ) : (
                <div className="flex flex-col items-end gap-1 text-xs text-muted">
                  <p>
                    <span className="uppercase tracking-wide text-dim">Bid</span>{' '}
                    <span className="ml-3 text-sm text-white">{playerBid}</span>
                  </p>
                  <p>
                    <span className="uppercase tracking-wide text-dim">Books</span>{' '}
                    <span className="ml-3 text-sm text-white">{playerBooks}</span>
                  </p>
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function ScoreHistory({ game, onClose }) {
  const playersById = new Map((game.players ?? []).map((player) => [player.id, player]))
  const orderedPlayers =
    (game.playerOrder ?? [])
      .map((playerId) => playersById.get(playerId))
      .filter(Boolean)
  const displayPlayers = orderedPlayers.length > 0 ? orderedPlayers : game.players ?? []
  const completedRoundCount = getCompletedRoundCount(game)
  const historyRounds = Array.from({ length: completedRoundCount }, (_, roundIndex) => {
    const roundConfig = game.options?.rounds?.[roundIndex]

    return {
      roundIndex,
      cardCount: roundConfig?.cardCount ?? '?',
      direction: roundConfig?.direction ?? 'up',
      players: displayPlayers
        .map((player) => {
          const score = game.scores?.find((entry) => entry.playerId === player.id)
          const round = score?.rounds?.[roundIndex]

          return {
            playerId: player.id,
            name: player.name,
            bid: round?.bid ?? '-',
            books: round?.books ?? 0,
            score: round?.total ?? 0,
            rainbow: round?.rainbow ?? false,
          }
        })
        .sort((left, right) => right.score - left.score),
    }
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 px-4 py-4"
      onClick={onClose}
    >
      <div
        className="dialog-surface flex max-h-[calc(100dvh-2rem)] w-full max-w-4xl flex-col overflow-hidden p-6 text-left"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Game History</h2>
        </div>
        {historyRounds.length === 0 ? (
          <p className="mt-4 text-sm text-dim">No completed rounds yet.</p>
        ) : (
          <div className="mt-4 min-h-0 flex-1 overflow-auto pr-1">
            <div className="flex flex-col gap-4">
              {historyRounds.map((round) => {
                const winningScore = round.players[0]?.score ?? null

                return (
                  <section key={round.roundIndex} className="panel-surface rounded-2xl border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold">
                        {`Round ${round.cardCount} ${getRoundDirectionArrow(round.direction)}`}
                      </h3>
                    </div>
                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-dim">
                            <th className="pb-2 pr-4 font-medium">Player</th>
                            <th className="pb-2 pr-4 font-medium">Bid</th>
                            <th className="pb-2 pr-4 font-medium">Books</th>
                            <th className="pb-2 pr-4 font-medium">Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {round.players.map((player) => (
                            <tr
                              key={player.playerId}
                              className={`border-t ${
                                winningScore !== null && player.score === winningScore
                                  ? 'winner-surface'
                                  : 'divider'
                              }`}
                            >
                              <td className="py-2 pr-4 font-medium text-white">
                                <span className="block max-w-[10rem] truncate" title={player.name}>
                                  {truncateLabel(player.name, 18)}
                                </span>
                              </td>
                              <td className="py-2 pr-4 text-white">{player.bid}</td>
                              <td className="py-2 pr-4 text-white">{player.books}</td>
                              <td className="py-2 pr-4 text-white">{player.score}{player.rainbow ? ' 🌈' : ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )
              })}
            </div>
          </div>
        )}
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            className="btn-secondary px-4 py-2 text-sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export function RoundStatusLabel({ isGameOver, currentRoundConfig, className = 'text-lg font-medium text-muted' }) {
  if (isGameOver) {
    return <p className={className}>Game Over</p>
  }

  if (currentRoundConfig) {
    return (
      <p className={className}>
        <span>{`Round ${currentRoundConfig.cardCount} `}</span>
        <span className="text-lg">{currentRoundConfig.direction === 'up' ? '⬆' : '⬇'}</span>
      </p>
    )
  }

  return <p className={className}>Round N/A</p>
}

export function ScoreSheet({
  title = 'Score',
  game,
  bids,
  booksByPlayerId,
  currentRoundIndex,
  currentRoundConfig,
  nowMs = Date.now(),
  isGameOver,
  isOwner,
  viewerPlayerId = '',
  onSelectPlayer,
  onOpenHistory,
  onClose,
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <RoundStatusLabel isGameOver={isGameOver} currentRoundConfig={currentRoundConfig} />
      </div>
      <ScoreSummary
        game={game}
        bids={bids}
        booksByPlayerId={booksByPlayerId}
        currentRoundIndex={currentRoundIndex}
        nowMs={nowMs}
        isGameOver={isGameOver}
        isOwner={isOwner}
        viewerPlayerId={viewerPlayerId}
        onSelectPlayer={onSelectPlayer}
      />
      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          className="link-accent"
          onClick={onOpenHistory}
        >
          See History
        </button>
        {onClose ? (
          <button
            type="button"
            className="btn-secondary px-4 py-2"
            onClick={onClose}
          >
            Close
          </button>
        ) : null}
      </div>
    </>
  )
}
