import { MAX_PLAYER_NAME_LENGTH } from '../utils/playerName'

export function HelpModal({
  isOpen,
  helpSection,
  setHelpSection,
  onClose,
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
        className="dialog-surface flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden p-6 text-left"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Welcome to Setback</h2>
        </div>
        <div className="divider mt-4 flex gap-2 border-b pb-4">
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              helpSection === 'how-to-play'
                ? 'bg-white text-slate-900'
                : 'badge-subtle border text-muted hover:text-white'
            }`}
            onClick={() => setHelpSection('how-to-play')}
          >
            How to Play
          </button>
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              helpSection === 'using-app'
                ? 'bg-white text-slate-900'
                : 'badge-subtle border text-muted hover:text-white'
            }`}
            onClick={() => setHelpSection('using-app')}
          >
            Using the App
          </button>
        </div>
        <div className="score-scroll mt-4 min-h-0 flex-1 overflow-auto pr-1 text-sm text-muted">
          {helpSection === 'using-app' ? (
            <>
              <section>
                <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-dim">Getting Started</h4>
                <div className="mt-4">
                  <h5 className="text-sm font-semibold text-white">New Game</h5>
                  <p className="mt-2">
                    When creating a new game, a user is prompted to enter their name. After the game is created, that user becomes
                    the game owner and enters the Lobby.
                  </p>
                </div>
                <div className="mt-4">
                  <h5 className="text-sm font-semibold text-white">Join Game</h5>
                  <p className="mt-2">
                    Users can join an existing game by clicking Join Game and entering the game ID along with their name. Users may
                    also use a shared link, given to them by other players. Using a shared link will populate the game ID for them.
                  </p>
                </div>
              </section>
              <section className="mt-4">
                <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-dim">The Lobby</h4>
                <p className="mt-2">
                  The lobby is where players gather before the game begins. The owner can share the game link or game ID with others so
                  more players can join in. Any open seat is represented by an AI player, and when someone joins they take over one of
                  those AI seats.
                </p>
                <div className="mt-2">
                  <p>Game owners can do the following before the game starts:</p>
                  <ul className="mt-2 ml-4 list-disc space-y-1 pl-5">
                    <li>Add AI seats to expand the lobby or remove AI seats to shrink it.</li>
                    <li>Adjust the seating order to control turn order and dealer rotation.</li>
                    <li>Remove human players from the game, which returns their seat to an AI player.</li>
                    <li>Choose Max Cards, which sets the largest hand size used in the round sequence.</li>
                    <li>Choose which player deals first when the game begins.</li>
                  </ul>
                </div>
                <p className="mt-2">
                  For other players, the lobby is mainly a waiting area. They can watch other players join. As others join, they will take
                  the seat of any AI players in the game. Seat count changes only happen in the lobby. After the game starts, player
                  removal only converts between human and AI control for an existing seat.
                </p>
              </section>
              <section className="mt-4">
                <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-dim">During the Game</h4>
                <p className="mt-2">
                  During the game, the main table shows the current round, score, tricks, trump, and your hand. Action buttons appear
                  based on the current phase, such as dealing, bidding, playing a card, sorting your hand, or starting over when the
                  game is finished.
                </p>
                <p className="mt-2">
                  The score area keeps track of bids, books, total score, and dealer position so players can quickly see how the round
                  is unfolding.
                </p>
              </section>
              <section className="mt-4">
                <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-dim">Game Menu</h4>
                <p className="mt-2">
                  The game menu can be opened during play to access common actions. From there, players can review their name, copy the
                  game link from the game ID button, start a new game, join another game, switch to a stored game, or open this Help panel.
                </p>
                <p className="mt-2">
                  The game owner also has access to owner-only actions like resetting the current game when appropriate.
                </p>
              </section>
            </>
          ) : (
            <>
              <section>
                <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-dim">Objective</h4>
                <p className="mt-2">
                  Score as many points as you can by making smart bids, winning tricks, and earning special bonuses.
                  When all rounds are complete, the player with the highest total score wins.
                </p>
              </section>

              <section className="mt-4">
                <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-dim">Playing The Game</h4>
                <p className="mt-2">
                  The game is played in a sequence of rounds based on the chosen maximum hand size. Rounds count down
                  from the max to 1, then climb back up to the max again. For example, a 10-card game plays
                  10, 9, 8 ... 1, 2 ... 10.
                </p>

                <div className="mt-4">
                  <h5 className="text-sm font-semibold text-white">Dealing</h5>
                  <p className="mt-2">
                    The dealer deals one card at a time to each player until everyone has the correct number of cards
                    for the round. After dealing, the dealer flips a card face-up to set the trump suit for the round.
                    If the card is a joker, it's placed under the deck and another card is turned over to set the trump
                    suit.
                  </p>
                </div>

                <div className="mt-4">
                  <h5 className="text-sm font-semibold text-white">Bidding</h5>
                  <p className="mt-2">
                    Starting with the player to the dealer&apos;s left, each player makes a bid. You may bid any number
                    from 0 up to the number of cards in the round.
                  </p>
                  <p className="mt-2">
                    In 3-card, 2-card, and 1-card rounds, players may also bid <span className="text-white">Trip</span>,
                    declaring they intend to win every trick in that round. Tripping triples the scoring for the round:
                    winning all tricks earns a triple bonus, but failing to win them all results in a triple penalty.
                  </p>
                </div>

                <div className="mt-4">
                  <h5 className="text-sm font-semibold text-white">Playing a Round</h5>
                  <p className="mt-2">
                    Each round consists of several tricks, one trick for every card in your hand. Your goal is to win enough
                    tricks to meet your bid, but you’re also trying to prevent other players from meeting theirs. Forcing
                    someone to miss their bid sets them back, which is where the game gets its name. The player who wins
                    a trick leads the next one, so momentum can shift quickly. Think of a round as a series of small battles,
                    each one giving you a chance to move closer to your bid while pushing others off course.
                  </p>
                </div>

                <div className="mt-4">
                  <h5 className="text-sm font-semibold text-white">Playing a Trick</h5>
                  <p className="mt-2">
                    A trick is a single turn where each player plays one card. After all players have played, one player wins
                    the trick based on the rules below. When a trick is won, it becomes a “book,” and the winner of that book
                    leads the next trick.
                  </p>

                  <p className="mt-2">
                    The first trick is led by the first player after the dealer among those who made the highest bid.
                    The card they play sets the <span className="text-white">lead suit</span>, and all players must follow
                    that suit if they can.
                  </p>

                  <p className="mt-2">
                    If you cannot follow suit, you may play any card. This includes <span className="text-white">trump</span>,
                    which acts like a powerful wild suit. Jokers count as trump. Trump cannot be led until it has been
                    broken, meaning someone has played trump because they couldn&apos;t follow suit, unless your entire hand
                    is trump.
                  </p>

                  <p className="mt-2">
                    A trick is won by the highest trump played. If no trump is played, the highest card in the lead suit
                    wins. Big Joker is highest, followed by Little Joker, then trump cards from Ace down to 2.
                  </p>
                </div>

                <div className="mt-4">
                  <h5 className="text-sm font-semibold text-white">Scoring</h5>
                  <p className="mt-2">
                    If you meet your bid, you earn 10 points per trick you bid, plus 1 extra point for each trick you
                    win beyond your bid. If you miss your bid, you lose 10 points per trick you bid.
                  </p>
                  <p className="mt-2">
                    <span className="text-white">Trip</span> is only available in 3-card, 2-card, and 1-card rounds.
                    A successful Trip, winning every trick, earns 30 points per trick. Failing a Trip costs 30 points per
                    trick instead.
                  </p>
                  <p className="mt-2">
                    In 4-card rounds, a player receives a <span className="text-white">Rainbow</span> bonus if they are
                    dealt four cards that cover all four suits. Jokers count as the trump suit for this purpose.
                    Achieving a Rainbow awards 25 bonus points.
                  </p>
                </div>

                <div className="mt-4">
                  <h5 className="text-sm font-semibold text-white">Winning The Game</h5>
                  <p className="mt-2">
                    After the final round, scores are totaled. The player with the highest score wins. If players are
                    tied, they share the final standing.
                  </p>
                </div>
              </section>
            </>
          )}
        </div>
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

export function AwayContinueModal({
  isOpen,
  isContinuingGame,
  onContinue,
}) {
  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/75 px-4 py-4">
      <div className="dialog-surface max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-6 text-left">
        <h2 className="text-xl font-semibold">Continue Game?</h2>
        <p className="mt-3 text-sm text-muted">
          The game owner marked you as away. Continue to return to the game.
        </p>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            className="btn-primary px-4 py-2 disabled:opacity-50"
            onClick={onContinue}
            disabled={isContinuingGame}
          >
            {isContinuingGame ? 'Continuing...' : 'Continue Game'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function BidModal({
  isOpen,
  currentRoundCardCount,
  isTripRound,
  selectedBid,
  setSelectedBid,
  isSubmittingBid,
  onClose,
  onSubmit,
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
        <h2 className="text-xl font-semibold">Bid</h2>
        <form className="mt-4 flex flex-col gap-4" onSubmit={onSubmit}>
          <label className="flex flex-col gap-2">
            <span className="text-sm text-muted">Bid Amount</span>
            <select
              value={selectedBid}
              onChange={(event) => setSelectedBid(event.target.value)}
              className="input-surface"
            >
              {Array.from({ length: currentRoundCardCount + 1 }, (_, index) => String(index)).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
              {isTripRound ? (
                <option value="trip">
                  Trip
                </option>
              ) : null}
            </select>
          </label>

          <div className="mt-2 flex justify-end gap-3">
            <button
              type="button"
              className="btn-secondary px-4 py-2"
              onClick={onClose}
              disabled={isSubmittingBid}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary px-4 py-2 disabled:opacity-50"
              disabled={isSubmittingBid}
            >
              {isSubmittingBid ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function EndOfRoundSummaryModal({
  summary,
  isOpen,
  getRoundDirectionArrow,
  onClose,
}) {
  if (!summary || !isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 px-4 py-4">
      <div
        className="dialog-surface max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto p-6 text-left"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-xl font-semibold">
          {`End of Round ${summary.cardCount} ${getRoundDirectionArrow(summary.direction)}`}
        </h2>
        <ul className="mt-4 flex flex-col gap-2">
          {summary.players.map((player) => {
            const winningScore = summary.players[0]?.score ?? null
            const isWinner = winningScore !== null && player.score === winningScore

            return (
              <li
                key={player.playerId}
                className={`rounded-md border px-3 py-3 ${
                  isWinner ? 'winner-surface' : 'panel-surface-strong'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-white">{player.name}</p>
                  <div className="flex items-center gap-4 text-sm text-muted">
                    <span>{`Bid ${player.bid}`}</span>
                    <span>{`Books ${player.books}`}</span>
                    <span className="font-medium text-white">{`Score ${player.score}`}{player.rainbow ? ' 🌈' : ''}</span>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="btn-primary px-4 py-2"
            onClick={onClose}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}

export function LobbyShareModal({
  isOpen,
  gameId,
  shareLink,
  isShareLinkCopied,
  shareQrCodeDataUrl,
  onCopyShareLink,
  onClose,
  LinkIcon,
}) {
  if (!isOpen) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-4"
      onClick={onClose}
    >
      <div
        className="dialog-surface max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-6 text-left"
        onClick={(event) => event.stopPropagation()}
      >
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
              <p className="text-center text-lg font-semibold text-white">{gameId}</p>
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
              <span className="min-w-0 truncate">
                {isShareLinkCopied ? 'Copied!' : shareLink}
              </span>
            </button>
          </div>
          <div className="flex w-fit self-center flex-col items-center rounded-xl border border-white/10 bg-white/95 p-2">
            {shareQrCodeDataUrl ? (
              <img
                src={shareQrCodeDataUrl}
                alt={`QR code for joining game ${gameId}`}
                className="h-48 w-48 max-w-full rounded-md"
              />
            ) : (
              <div className="flex h-48 w-48 max-w-full items-center justify-center rounded-md bg-slate-100 text-sm text-slate-500">
                Generating QR code...
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              className="btn-secondary px-3 py-1.5"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ConfirmLobbyActionModal({
  isOpen,
  title,
  description,
  confirmLabel,
  pendingLabel,
  isPending,
  onConfirm,
  onClose,
}) {
  if (!isOpen) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-4"
      onClick={onClose}
    >
      <div
        className="dialog-surface max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-6 text-left"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="mt-3 text-sm text-muted">
          {description}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="btn-secondary px-4 py-2"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-danger btn-danger-soft px-4 py-2 disabled:opacity-50"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function RenameLobbyPlayerModal({
  player,
  draftValue,
  setDraftValue,
  isRenamingPlayer,
  onSubmit,
  onClose,
}) {
  if (!player) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-4"
      onClick={onClose}
    >
      <div
        className="dialog-surface max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-6 text-left"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-xl font-semibold text-white">Edit Player Name</h2>
        <p className="mt-3 text-sm text-muted">
          {player.name}
        </p>
        <form className="mt-5 flex flex-col gap-4" onSubmit={onSubmit}>
          <input
            type="text"
            value={draftValue}
            onChange={(event) => setDraftValue(event.target.value)}
            className="input-surface"
            placeholder="Player name"
            maxLength={MAX_PLAYER_NAME_LENGTH}
            autoFocus
          />
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="btn-secondary px-4 py-2"
              onClick={onClose}
              disabled={isRenamingPlayer}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary px-4 py-2 disabled:opacity-50"
              disabled={isRenamingPlayer || !draftValue.trim()}
            >
              {isRenamingPlayer ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
