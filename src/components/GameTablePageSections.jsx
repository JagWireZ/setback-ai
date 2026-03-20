import { CardAsset, CardBack } from './Cards'
import { ScoreSummary } from './Scoreboard'
import { REACTION_EMOJIS, getBidDisplay, getCardLabel, getInvalidPlayMessage, getPlayerName } from '../utils/gameUi'

function GameTableReactionOverlay({ emojiReactionLayouts, phraseReactionLayouts, floatingCelebrations, game }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      {emojiReactionLayouts.map(({ reaction, style }) => (
        <div key={reaction.id} className="reaction-float" style={style}>
          <div className={`reaction-badge ${reaction.phrase ? 'reaction-badge-phrase' : ''}`}>
            {reaction.phrase ? (
              <>
                <span className="reaction-speaker truncate">{getPlayerName(game, reaction.playerId)}</span>
                <span className="reaction-text">{reaction.phrase}</span>
              </>
            ) : (
              <>
                <span className="truncate">{getPlayerName(game, reaction.playerId)}</span>
                <span className="text-2xl leading-none">{reaction.emoji ?? ''}</span>
              </>
            )}
          </div>
        </div>
      ))}
      {phraseReactionLayouts.map(({ reaction, style }) => (
        <div key={reaction.id} className="reaction-float-phrase" style={style}>
          <div className="reaction-badge reaction-badge-phrase">
            <span className="reaction-speaker truncate">{getPlayerName(game, reaction.playerId)}</span>
            <span className="reaction-text">{reaction.phrase ?? ''}</span>
          </div>
        </div>
      ))}
      {floatingCelebrations.map(({ id, message, style }) => (
        <div key={id} className="celebration-float" style={style}>
          <div className="celebration-badge">
            <span className="celebration-spark" aria-hidden="true">✦</span>
            <span>{message}</span>
            <span className="celebration-spark" aria-hidden="true">✦</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function GameTableHeader({ onGoHome, trumpCard }) {
  return (
    <article className="shrink-0 px-1 py-3 -translate-y-[15%]">
      <div className="flex items-center justify-between gap-4 text-sm text-muted">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <button
            type="button"
            className="w-fit rounded-md transition hover:scale-[1.02]"
            onClick={onGoHome}
            aria-label="Go home"
          >
            <img src="/logo-512x512.png" alt="Setback" className="h-20 w-20 shrink-0 rounded-md" />
          </button>
        </div>
        {trumpCard ? (
          <div className="mt-2 flex shrink-0 items-center gap-2 self-start md:mt-0">
            <p className="text-sm text-dim">Trump</p>
            <div className="relative h-[76px] w-[70px] shrink-0 md:h-[84px] md:w-[78px]">
              <div className="absolute left-0 top-0 h-[76px] w-[54px] md:h-[84px] md:w-[60px]">
                <CardBack />
              </div>
              <div
                className="absolute top-0 h-[76px] w-[54px] md:h-[84px] md:w-[60px]"
                style={{ left: '0.75rem' }}
              >
                <CardAsset card={trumpCard} showCornerSuit={false} />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  )
}

function GameTableActionBar({
  availableActions,
  canSortCards,
  handleReactionCategorySelect,
  isActionEnabled,
  isDealingCards,
  isMobileBar,
  isMobileViewport,
  isPlayingCard,
  isReactionModalOpen,
  isReactionOnCooldown,
  isSendingReaction,
  isSortingCards,
  isStartingOver,
  isSubmittingBid,
  isViewerActualTurn,
  onDealCards,
  onOpenJoinGame,
  onOpenNewGame,
  onPlayCard,
  onSendReaction,
  onSortCards,
  onStartOver,
  onSubmitBid,
  reactionModalPosition,
  reactionPhraseCategories,
  reactionPhraseOptions,
  reactionPickerRef,
  selectedCard,
  selectedReactionPhraseCategoryId,
  setIsMenuModalOpen,
  setIsReactionModalOpen,
  setIsScoreModalOpen,
  sortMode,
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-3">
      <div className="flex items-center justify-start gap-3">
        <button
          type="button"
          className="min-h-12 border-0 bg-transparent px-1 py-1 text-[1.55rem] leading-none text-white transition hover:scale-110"
          onClick={() => setIsMenuModalOpen(true)}
          aria-label="Open game menu"
        >
          ☰
        </button>
      </div>
      <div className="min-w-0">
        <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:w-max sm:min-w-full sm:flex-nowrap sm:gap-3">
          {isMobileBar ? (
            <button
              type="button"
              className="btn-accent min-h-11 whitespace-nowrap px-3 py-2.5 text-xs sm:min-h-12 sm:px-4 sm:py-3 sm:text-sm"
              onClick={() => setIsScoreModalOpen(true)}
            >
              Score
            </button>
          ) : null}
          {canSortCards ? (
            <button
              type="button"
              className="btn-accent min-h-11 whitespace-nowrap px-3 py-2.5 text-xs disabled:opacity-50 sm:min-h-12 sm:px-4 sm:py-3 sm:text-sm"
              onClick={onSortCards}
              disabled={isSortingCards}
            >
              {isSortingCards ? (
                'Sorting...'
              ) : (
                <span className="inline-flex items-center gap-2">
                  <span className="sort-toggle-icon" aria-hidden="true">
                    <span />
                    <i />
                  </span>
                  <span>{sortMode === 'bySuit' ? 'By Rank' : 'By Suit'}</span>
                </span>
              )}
            </button>
          ) : null}
          {availableActions.length > 0
            ? availableActions.map((action) => {
                const isDisabled =
                  !isActionEnabled(action) ||
                  isDealingCards ||
                  isSubmittingBid ||
                  isPlayingCard ||
                  isSortingCards ||
                  isStartingOver
                const shouldFlashActionButton =
                  ((action === 'Deal Cards' || action === 'Submit Bid') && isViewerActualTurn && !isDisabled) ||
                  (action === 'Play Card' && isViewerActualTurn && selectedCard !== null && !isDisabled)
                const isPrimaryAction =
                  !isDisabled &&
                  (action === 'Deal Cards' || action === 'Submit Bid' || action === 'Play Card' || action === 'Start Over')

                return (
                  <button
                    key={action}
                    type="button"
                    className={`min-h-11 whitespace-nowrap rounded-md border px-3 py-2.5 text-xs text-white disabled:opacity-50 sm:min-h-12 sm:px-4 sm:py-3 sm:text-sm ${
                      shouldFlashActionButton
                        ? 'btn-accent-pulse animate-pulse'
                        : isPrimaryAction
                          ? 'btn-accent btn-accent-glow'
                          : 'btn-accent'
                    }`}
                    disabled={isDisabled}
                    onClick={
                      action === 'Deal Cards'
                        ? onDealCards
                        : action === 'Submit Bid'
                          ? onSubmitBid
                          : action === 'Play Card'
                            ? () => {
                                if (selectedCard) {
                                  onPlayCard(selectedCard)
                                }
                              }
                            : action === 'Start Over'
                              ? onStartOver
                              : action === 'New Game'
                                ? onOpenNewGame
                                : action === 'Join Game'
                                  ? onOpenJoinGame
                                  : undefined
                    }
                  >
                    {action === 'Deal Cards' && isDealingCards
                      ? 'Dealing...'
                      : action === 'Start Over' && isStartingOver
                        ? 'Starting...'
                        : action === 'Submit Bid' && isSubmittingBid
                          ? 'Submitting...'
                          : action === 'Play Card' && isPlayingCard
                            ? 'Playing...'
                            : action === 'Submit Bid'
                              ? 'Bid'
                              : action}
                  </button>
                )
              })
            : null}
        </div>
      </div>
      <div
        className="relative flex items-center justify-end"
        ref={isMobileBar === isMobileViewport ? reactionPickerRef : undefined}
      >
        {isReactionModalOpen && isMobileBar === isMobileViewport ? (
          <div
            className="floating-panel fixed right-4 z-50 w-[20rem] max-w-[calc(100vw-2rem)] rounded-2xl p-3"
            style={{
              right: `${reactionModalPosition.right}px`,
              bottom: `${reactionModalPosition.bottom}px`,
            }}
          >
            {reactionPhraseCategories.length > 0 ? (
              <div className="mb-3 grid grid-cols-3 gap-2">
                {reactionPhraseCategories.map((category) => {
                  const isActive = category.id === selectedReactionPhraseCategoryId

                  return (
                    <button
                      key={category.id}
                      type="button"
                      className={`min-h-10 rounded-2xl border px-2 py-1.5 text-center text-[0.65rem] font-semibold uppercase tracking-[0.12em] transition ${
                        isActive
                          ? 'border-amber-300/80 bg-amber-200/20 text-amber-50'
                          : 'border-white/15 bg-white/5 text-white/80 hover:border-white/30 hover:bg-white/10'
                      }`}
                      onClick={() => handleReactionCategorySelect(category.id)}
                      disabled={isSendingReaction || isReactionOnCooldown}
                    >
                      {category.label}
                    </button>
                  )
                })}
              </div>
            ) : null}
            {reactionPhraseOptions.length > 0 ? (
              <div className="mb-3 grid gap-2">
                {reactionPhraseOptions.map((phrase) => (
                  <button
                    key={phrase}
                    type="button"
                    className="rounded-2xl border border-white/12 bg-white/6 px-3 py-2 text-left text-sm text-white transition hover:border-white/25 hover:bg-white/10 disabled:opacity-50"
                    onClick={async () => {
                      try {
                        await onSendReaction?.({ phrase })
                        setIsReactionModalOpen(false)
                      } catch {
                        // Keep the picker open so the user can retry.
                      }
                    }}
                    disabled={isSendingReaction || isReactionOnCooldown}
                  >
                    {phrase}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="grid grid-cols-4 gap-2">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="flex h-11 items-center justify-center rounded-xl bg-transparent text-[1.8rem] transition hover:scale-110 disabled:opacity-50"
                  onClick={async () => {
                    try {
                      await onSendReaction?.({ emoji })
                      setIsReactionModalOpen(false)
                    } catch {
                      // Keep the picker open so the user can retry.
                    }
                  }}
                  disabled={isSendingReaction || isReactionOnCooldown}
                  aria-label={`Send ${emoji} reaction`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <button
          type="button"
          className="min-h-12 border-0 bg-transparent px-1 py-1 text-3xl leading-none text-white transition hover:scale-110 disabled:opacity-50"
          onClick={() => setIsReactionModalOpen((current) => !current)}
          disabled={isSendingReaction || isReactionOnCooldown || typeof onSendReaction !== 'function'}
          aria-label="Open reactions"
        >
          😀
        </button>
      </div>
    </div>
  )
}

function GameTableScorePanel({
  bids,
  booksByPlayerId,
  currentRoundConfig,
  currentRoundIndex,
  game,
  isGameOver,
  isOwner,
  nowMs,
  onOpenHistory,
  onSelectPlayer,
  viewerPlayerId,
}) {
  return (
    <article className="score-scroll score-panel hidden min-h-0 max-h-full self-start overflow-auto rounded-2xl border pb-4 pl-4 pr-1 pt-4 md:block">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Score</h2>
        {isGameOver ? (
          <p className="text-lg font-medium text-muted">Game Over</p>
        ) : currentRoundConfig ? (
          <p className="text-lg font-medium text-muted">
            <span>{`Round ${currentRoundConfig.cardCount} `}</span>
            <span className="text-lg">{currentRoundConfig.direction === 'up' ? '⬆' : '⬇'}</span>
          </p>
        ) : (
          <p className="text-lg font-medium text-muted">Round N/A</p>
        )}
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
      <div className="mt-4 flex justify-end pr-3">
        <button type="button" className="link-accent" onClick={onOpenHistory}>
          See History
        </button>
      </div>
    </article>
  )
}

function GameTableStatusBanner({
  bookWinnerMessage,
  displayedTurnPlayerId,
  game,
  isAwayTurnPlayer,
  isGameOver,
  isOwner,
  isTrickWinnerRevealVisible,
  isViewerTurnVisible,
  viewerTurnMessage,
  waitingAction,
}) {
  return (
    <div className="mt-3 flex min-h-7 items-center justify-center">
      {bookWinnerMessage ? (
        <p className="status-info px-6 py-2 text-center text-xl font-semibold">{bookWinnerMessage}</p>
      ) : isGameOver || isTrickWinnerRevealVisible ? null : isViewerTurnVisible ? (
        <p className="status-turn px-6 py-2 text-xl font-semibold">{viewerTurnMessage}</p>
      ) : displayedTurnPlayerId ? (
        <p className="text-sm text-dim">
          {waitingAction
            ? `Waiting on ${getPlayerName(game, displayedTurnPlayerId)}${isOwner && isAwayTurnPlayer ? ' (Away)' : ''} to ${waitingAction}`
            : `Waiting on ${getPlayerName(game, displayedTurnPlayerId)}${isOwner && isAwayTurnPlayer ? ' (Away)' : ''}...`}
        </p>
      ) : null}
    </div>
  )
}

function GameTableHand({
  canSelectCards,
  children,
  game,
  handLayout,
  isGameOver,
  isPlayingCard,
  isViewerTurnVisible,
  onSetGameError,
  selectedCardIndex,
  setSelectedCardIndex,
  viewerHand,
}) {
  return (
    <article
      className={`mt-3 shrink-0 overflow-hidden rounded-3xl border p-1 sm:overflow-x-auto ${
        isViewerTurnVisible
          ? 'hand-active hand-active-turn'
          : canSelectCards
            ? 'hand-active'
            : 'divider'
      }`}
    >
      <div className="flex min-h-[8rem] items-center justify-center pt-6 pb-2">
        {(viewerHand?.cards ?? []).length > 0 ? (
          viewerHand.cards.map((card, index) => {
            const invalidPlayMessage = canSelectCards ? getInvalidPlayMessage(game, viewerHand, card) : ''
            const isInvalidPlay = invalidPlayMessage.length > 0

            return (
              <button
                key={`${card.rank}-${card.suit}-${index}`}
                type="button"
                onClick={() => {
                  if (!canSelectCards) {
                    return
                  }

                  if (isInvalidPlay) {
                    setSelectedCardIndex(null)
                    onSetGameError?.(invalidPlayMessage)
                    return
                  }

                  onSetGameError?.('')
                  setSelectedCardIndex((currentIndex) => (currentIndex === index ? null : index))
                }}
                disabled={!canSelectCards || isPlayingCard}
                className={`relative shrink-0 overflow-visible rounded-lg bg-transparent p-0 transition-all duration-150 ${
                  selectedCardIndex === index ? '-translate-y-4' : 'translate-y-0'
                }`}
                style={{
                  marginLeft: index === 0 ? '0' : handLayout.overlapOffset,
                  zIndex: index + 1,
                }}
                aria-label={getCardLabel(card)}
              >
                <div
                  className={`aspect-[2.5/3.5] ${handLayout.useCompactSizing ? '' : 'w-20 sm:w-24'}`}
                  style={{
                    ...(handLayout.useCompactSizing ? { width: handLayout.cardWidth } : {}),
                    filter: canSelectCards
                      ? isInvalidPlay
                        ? 'brightness(0.50)'
                        : 'drop-shadow(0 0 12px rgba(120, 255, 180, 0.22))'
                      : undefined,
                  }}
                >
                  <CardAsset
                    card={card}
                    showCenterSymbol={!handLayout.useCompactSizing}
                    centerSymbolClassName="text-[104%] leading-none sm:text-[132%]"
                    jokerTextClassName="text-[42%] font-bold tracking-[0.06em]"
                  />
                </div>
              </button>
            )
          })
        ) : (
          <p className="text-sm text-dim">{isGameOver ? '' : 'No cards in hand yet.'}</p>
        )}
      </div>
      {children}
    </article>
  )
}

function GameTableBiddingPanel({
  bids,
  bidsByPlayerId,
  biddingPlayers,
  currentRoundIndex,
  displayedTurnPlayerId,
  game,
}) {
  return (
    <section className="panel-surface mb-3 flex min-h-0 flex-1 flex-col rounded-2xl border px-3 py-3 sm:px-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-accent-strong text-sm font-semibold uppercase tracking-[0.18em]">Bids</h2>
        <p className="text-accent text-xs">
          {bids.length}/{biddingPlayers.length} in
        </p>
      </div>
      <ul className="score-scroll mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-auto pr-1">
        {biddingPlayers.map((player) => {
          const bidEntry = bidsByPlayerId.get(player.id)
          const isCurrentBidder = displayedTurnPlayerId === player.id
          const hasBid = Boolean(bidEntry)
          const playerScore = game.scores?.find((entry) => entry.playerId === player.id)
          const playerRainbow = playerScore?.rounds?.[currentRoundIndex]?.rainbow === true

          return (
            <li
              key={player.id}
              className={`rounded-xl border px-3 py-2 text-left ${isCurrentBidder ? 'callout-success-strong' : 'list-item-subtle'}`}
            >
              <div className="grid grid-cols-[minmax(0,1fr)_3rem_4.75rem] items-center gap-3">
                <p className="min-w-0 truncate text-sm font-medium text-white">
                  {player.name}
                  {playerRainbow ? ' 🌈' : ''}
                </p>
                <p className={`text-right text-base font-semibold ${hasBid ? 'text-accent-strong' : 'text-dim'}`}>
                  {getBidDisplay(bidEntry)}
                </p>
                <p className="text-right text-[0.68rem] uppercase tracking-[0.14em] text-dim">
                  {hasBid ? 'Locked' : isCurrentBidder ? 'Bidding' : 'Waiting'}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function GameTableTrickArea({
  bookWinnerMessage,
  displayedTrickPlays,
  game,
  getPassiveTrickPlayerLabel,
  handleSelectTrickCard,
  isGameOver,
  leadTrickPlayerId,
  passiveTrickLabelStyles,
  returningTrickLabel,
  scatterTrickPositionsByPlayerId,
  selectedTrickCardIndex,
  setSelectedTrickCardIndex,
  trickCardButtonRefs,
  trickLayout,
  trickPlayCount,
  trickSurfaceRef,
  useScatterTrickLayout,
}) {
  return (
    <article
      className="flex min-h-0 flex-col p-1"
      onClick={(event) => {
        if (selectedTrickCardIndex === null || bookWinnerMessage) {
          return
        }

        if (event.target.closest('button')) {
          return
        }

        setSelectedTrickCardIndex(null)
      }}
    >
      <div ref={trickSurfaceRef} className="relative flex min-h-[152px] flex-1 overflow-visible">
        {selectedTrickCardIndex !== null && !useScatterTrickLayout ? (
          <div className="pointer-events-none absolute inset-0 z-20">
            {returningTrickLabel ? (
              <p
                key={returningTrickLabel.key}
                className="trick-card-player-label absolute truncate text-left"
                style={returningTrickLabel.style}
              >
                {returningTrickLabel.text}
              </p>
            ) : null}
            {displayedTrickPlays.map((play, index) => {
              const labelStyle = passiveTrickLabelStyles[index]
              if (!labelStyle || selectedTrickCardIndex === index) {
                return null
              }

              return (
                <p
                  key={`passive-trick-label-${play.playerId}-${index}`}
                  className="trick-card-player-label absolute truncate text-left"
                  style={labelStyle}
                >
                  {getPassiveTrickPlayerLabel(getPlayerName(game, play.playerId), index, displayedTrickPlays.length)}
                </p>
              )
            })}
          </div>
        ) : null}
        <ul
          className={
            useScatterTrickLayout
              ? 'relative min-h-[220px] flex-1 overflow-visible pt-8'
              : 'flex min-h-[152px] flex-1 items-center justify-center gap-4 overflow-x-auto pt-12 -translate-y-2'
          }
        >
          {displayedTrickPlays.length > 0 ? (
            displayedTrickPlays.map((play, index) => (
              <li
                key={`${play.playerId}-${index}`}
                className={
                  useScatterTrickLayout
                    ? 'absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-sm'
                    : 'flex w-fit shrink-0 flex-col items-center text-sm'
                }
                style={
                  useScatterTrickLayout
                    ? {
                        ...(scatterTrickPositionsByPlayerId.get(play.playerId) ?? {
                          left: '50%',
                          top: '48%',
                        }),
                        zIndex:
                          selectedTrickCardIndex === index
                            ? trickPlayCount + 20
                            : play.playerId === leadTrickPlayerId
                              ? trickPlayCount + 10
                              : index + 1,
                      }
                    : {
                        marginLeft: index === 0 ? '0' : trickLayout.overlapOffset,
                        zIndex: index + 1,
                      }
                }
              >
                <button
                  ref={(node) => {
                    trickCardButtonRefs.current[index] = node
                  }}
                  type="button"
                  className={`relative shrink-0 overflow-visible rounded-lg bg-transparent p-0 transition-transform duration-150 ${
                    selectedTrickCardIndex === index
                      ? useScatterTrickLayout
                        ? 'z-20 scale-110'
                        : '-translate-y-4'
                      : 'translate-y-0'
                  }`}
                  onClick={() => handleSelectTrickCard(index)}
                  aria-label={getPlayerName(game, play.playerId)}
                >
                  {selectedTrickCardIndex === null && !useScatterTrickLayout ? (
                    <p className="trick-card-player-label pointer-events-none absolute bottom-full left-2 mb-1.5 w-12 truncate text-left sm:left-1 sm:w-24">
                      {getPassiveTrickPlayerLabel(getPlayerName(game, play.playerId), index, displayedTrickPlays.length)}
                    </p>
                  ) : null}
                  <div
                    className={`aspect-[2.5/3.5] ${trickLayout.useCompactSizing ? '' : 'w-24 sm:w-28'}`}
                    style={{
                      ...(trickLayout.useCompactSizing ? { width: trickLayout.cardWidth } : {}),
                      ...(selectedTrickCardIndex === index
                        ? { filter: 'drop-shadow(0 0 16px rgba(255,255,255,0.55))' }
                        : {}),
                    }}
                  >
                    <CardAsset
                      card={play.card}
                      showCenterSymbol={!trickLayout.useCompactSizing}
                      centerSymbolClassName="text-[104%] leading-none sm:text-[132%]"
                      jokerTextClassName="text-[70%] font-bold tracking-[0.06em]"
                    />
                  </div>
                </button>
                {useScatterTrickLayout ? (
                  <div className="pointer-events-none mt-1 flex flex-col items-center">
                    <p
                      className={`rounded-full px-2 py-0.5 text-center text-[0.62rem] transition ${
                        selectedTrickCardIndex === index
                          ? 'border border-white/30 bg-slate-950/95 text-white shadow-[0_4px_14px_rgba(15,23,42,0.45)]'
                          : 'border border-white/10 bg-black/35 text-white/70'
                      }`}
                    >
                      <span
                        className={
                          selectedTrickCardIndex === index
                            ? 'block max-w-[8.5rem] whitespace-nowrap text-sm font-medium'
                            : 'block max-w-[4.75rem] truncate'
                        }
                      >
                        {selectedTrickCardIndex === index
                          ? getPlayerName(game, play.playerId)
                          : getPassiveTrickPlayerLabel(getPlayerName(game, play.playerId), index, displayedTrickPlays.length)}
                      </span>
                    </p>
                    {play.playerId === leadTrickPlayerId ? (
                      <p className="mt-0.5 text-[0.65rem] font-medium tracking-[0.18em] text-dim">LEAD</p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))
          ) : (
            <li className="self-center text-sm text-dim">{isGameOver ? '' : 'No cards played in this trick yet.'}</li>
          )}
        </ul>
      </div>
    </article>
  )
}

export {
  GameTableActionBar,
  GameTableBiddingPanel,
  GameTableHeader,
  GameTableHand,
  GameTableReactionOverlay,
  GameTableScorePanel,
  GameTableStatusBanner,
  GameTableTrickArea,
}
