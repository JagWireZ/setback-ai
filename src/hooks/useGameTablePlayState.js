import { useEffect, useMemo, useRef, useState } from 'react'
import { TRICK_COMPLETE_DELAY_MS, getPlayerName, hashString } from '../utils/gameUi'
import { truncateLabel } from '../utils/playerName'

export function useGameTablePlayState({
  actualTurnPlayerId,
  completedTricks,
  currentTrick,
  game,
  isMobileViewport,
  mobileActionBarHeight,
  orderedPlayers,
  viewerHand,
  viewerPlayerId,
  viewportWidth,
}) {
  const [selectedCardIndex, setSelectedCardIndex] = useState(null)
  const [selectedTrickCardIndex, setSelectedTrickCardIndex] = useState(null)
  const [bookWinnerMessage, setBookWinnerMessage] = useState('')
  const [revealedCompletedTrick, setRevealedCompletedTrick] = useState(null)
  const [displayedTurnPlayerId, setDisplayedTurnPlayerId] = useState(actualTurnPlayerId)
  const [selectedTrickLabelStyle, setSelectedTrickLabelStyle] = useState(null)
  const [passiveTrickLabelStyles, setPassiveTrickLabelStyles] = useState([])
  const [returningTrickLabel, setReturningTrickLabel] = useState(null)
  const [floatingCelebrations, setFloatingCelebrations] = useState([])

  const previousCompletedTrickCountRef = useRef(0)
  const floatingCelebrationTimeoutsRef = useRef([])
  const bookWinnerTimeoutRef = useRef(null)
  const selectedTrickCardTimeoutRef = useRef(null)
  const returningTrickLabelTimeoutRef = useRef(null)
  const returningTrickLabelFrameRef = useRef(null)
  const trickSurfaceRef = useRef(null)
  const trickCardButtonRefs = useRef([])
  const selectedTrickLabelRef = useRef(null)
  const previousTrickIndexRef = useRef(game?.phase?.trickIndex)
  const previousTrumpBrokenRef = useRef(
    game?.phase && 'cards' in game.phase ? Boolean(game.phase.cards.trumpBroken) : null,
  )
  const shouldClearSelectedTrickCardAfterRevealRef = useRef(false)
  const isHoldingTurnPlayerRef = useRef(false)
  const latestActualTurnPlayerIdRef = useRef(actualTurnPlayerId)

  latestActualTurnPlayerIdRef.current = actualTurnPlayerId

  const isViewerActualTurn = Boolean(viewerPlayerId && actualTurnPlayerId && viewerPlayerId === actualTurnPlayerId)
  const isViewerDisplayedTurn = Boolean(
    viewerPlayerId && displayedTurnPlayerId && viewerPlayerId === displayedTurnPlayerId,
  )
  const isTrickWinnerRevealVisible = Boolean(bookWinnerMessage || revealedCompletedTrick)
  const isViewerTurnVisible = isViewerDisplayedTurn && !isTrickWinnerRevealVisible
  const canSelectCards = game.phase?.stage === 'Playing' && isViewerActualTurn && !isTrickWinnerRevealVisible
  const displayedTrick = revealedCompletedTrick ?? currentTrick
  const displayedTrickPlays = displayedTrick?.plays ?? []
  const trickPlayCount = displayedTrickPlays.length
  const totalTrickPlayers = orderedPlayers.length > 0 ? orderedPlayers.length : (game.playerOrder?.length ?? game.players?.length ?? 0)
  const leadTrickPlayerId = displayedTrick?.leadPlayerId ?? displayedTrickPlays[0]?.playerId ?? ''
  const winningDisplayedTrickCardIndex =
    revealedCompletedTrick?.winnerPlayerId
      ? revealedCompletedTrick.plays.findIndex((play) => play.playerId === revealedCompletedTrick.winnerPlayerId)
      : null
  const selectedCard =
    selectedCardIndex !== null && viewerHand?.cards?.[selectedCardIndex]
      ? viewerHand.cards[selectedCardIndex]
      : null
  const selectedTrickPlay =
    selectedTrickCardIndex !== null && displayedTrickPlays?.[selectedTrickCardIndex]
      ? displayedTrickPlays[selectedTrickCardIndex]
      : null
  const selectedTrickPlayerName = selectedTrickPlay ? getPlayerName(game, selectedTrickPlay.playerId) : ''

  useEffect(() => () => {
    floatingCelebrationTimeoutsRef.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId)
    })
    floatingCelebrationTimeoutsRef.current = []
  }, [])

  useEffect(() => {
    if (!canSelectCards) {
      setSelectedCardIndex(null)
      return
    }

    if (!viewerHand?.cards?.[selectedCardIndex ?? -1]) {
      setSelectedCardIndex(null)
    }
  }, [canSelectCards, selectedCardIndex, viewerHand?.cards])

  useEffect(() => {
    setDisplayedTurnPlayerId(actualTurnPlayerId)
    isHoldingTurnPlayerRef.current = false
  }, [actualTurnPlayerId, game?.id])

  useEffect(() => {
    if (isHoldingTurnPlayerRef.current || bookWinnerMessage) {
      return
    }

    setDisplayedTurnPlayerId(actualTurnPlayerId)
  }, [actualTurnPlayerId, bookWinnerMessage])

  useEffect(() => {
    setSelectedCardIndex(null)
  }, [displayedTurnPlayerId, game.phase?.stage, game.phase?.trickIndex])

  useEffect(() => {
    if (winningDisplayedTrickCardIndex !== null && winningDisplayedTrickCardIndex >= 0) {
      if (selectedTrickCardIndex !== winningDisplayedTrickCardIndex) {
        setSelectedTrickCardIndex(winningDisplayedTrickCardIndex)
      }
      return
    }

    if (selectedTrickCardIndex !== null && !displayedTrickPlays[selectedTrickCardIndex]) {
      setSelectedTrickCardIndex(null)
    }
  }, [displayedTrickPlays, selectedTrickCardIndex, winningDisplayedTrickCardIndex])

  useEffect(() => {
    const currentTrickIndex = game?.phase?.trickIndex
    const previousTrickIndex = previousTrickIndexRef.current

    if (
      typeof currentTrickIndex === 'number' &&
      typeof previousTrickIndex === 'number' &&
      currentTrickIndex > previousTrickIndex
    ) {
      shouldClearSelectedTrickCardAfterRevealRef.current = true
    }

    previousTrickIndexRef.current = currentTrickIndex
  }, [game?.phase?.trickIndex])

  useEffect(() => {
    const currentTrumpBroken =
      game?.phase && 'cards' in game.phase ? Boolean(game.phase.cards.trumpBroken) : null
    const previousTrumpBroken = previousTrumpBrokenRef.current

    if (previousTrumpBroken === false && currentTrumpBroken === true) {
      const celebrationId = `trump-broken-${game.id}-${Date.now()}`
      const hash = hashString(celebrationId)
      const driftDirection = hash % 2 === 0 ? 1 : -1
      const driftA = driftDirection * (20 + ((hash >> 3) % 12))
      const driftB = driftDirection * -1 * (16 + ((hash >> 6) % 16))
      const driftC = driftDirection * (28 + ((hash >> 9) % 16))

      setFloatingCelebrations((current) => [
        ...current,
        {
          id: celebrationId,
          message: 'Trump has been broken!',
          style: {
            left: '50%',
            bottom: `${mobileActionBarHeight + 48}px`,
            '--reaction-sway-a': `${driftA}px`,
            '--reaction-sway-b': `${driftB}px`,
            '--reaction-sway-c': `${driftC}px`,
          },
        },
      ])

      const timeoutId = window.setTimeout(() => {
        setFloatingCelebrations((current) =>
          current.filter((celebration) => celebration.id !== celebrationId),
        )
        floatingCelebrationTimeoutsRef.current = floatingCelebrationTimeoutsRef.current.filter(
          (currentTimeoutId) => currentTimeoutId !== timeoutId,
        )
      }, 7000)

      floatingCelebrationTimeoutsRef.current.push(timeoutId)
    }

    previousTrumpBrokenRef.current = currentTrumpBroken
  }, [game.id, game?.phase, mobileActionBarHeight])

  useEffect(() => {
    if (bookWinnerMessage || revealedCompletedTrick || !shouldClearSelectedTrickCardAfterRevealRef.current) {
      return
    }

    setSelectedTrickCardIndex(null)
    shouldClearSelectedTrickCardAfterRevealRef.current = false
  }, [bookWinnerMessage, revealedCompletedTrick])

  useEffect(() => {
    if (bookWinnerMessage || selectedTrickCardIndex === null) {
      if (selectedTrickCardTimeoutRef.current) {
        clearTimeout(selectedTrickCardTimeoutRef.current)
        selectedTrickCardTimeoutRef.current = null
      }
      return
    }

    selectedTrickCardTimeoutRef.current = setTimeout(() => {
      setSelectedTrickCardIndex(null)
      selectedTrickCardTimeoutRef.current = null
    }, 2000)

    return () => {
      if (selectedTrickCardTimeoutRef.current) {
        clearTimeout(selectedTrickCardTimeoutRef.current)
        selectedTrickCardTimeoutRef.current = null
      }
    }
  }, [bookWinnerMessage, selectedTrickCardIndex])

  const getPassiveTrickPlayerLabel = (playerName, index, playCount) => {
    const isOverlappedFromLeft = index > 0
    const isOverlappedFromRight = index < playCount - 1
    const maxLength =
      isMobileViewport
        ? playCount >= 4
          ? isOverlappedFromLeft && isOverlappedFromRight
            ? 7
            : 9
          : isOverlappedFromLeft && isOverlappedFromRight
            ? 8
            : isOverlappedFromLeft || isOverlappedFromRight
              ? 10
              : 12
        : isOverlappedFromLeft && isOverlappedFromRight
          ? 10
          : isOverlappedFromLeft || isOverlappedFromRight
            ? 13
            : 18

    return truncateLabel(playerName, maxLength)
  }

  const getPassiveTrickLabelStyle = (surfaceElement, index) => {
    const cardButtonElement = trickCardButtonRefs.current[index]
    if (!surfaceElement || !cardButtonElement) {
      return null
    }

    const surfaceRect = surfaceElement.getBoundingClientRect()
    const cardRect = cardButtonElement.getBoundingClientRect()
    const labelWidth = isMobileViewport ? 48 : 96

    return {
      left: `${cardRect.left - surfaceRect.left + (isMobileViewport ? 8 : 4)}px`,
      top: `${Math.max(cardRect.top - surfaceRect.top - 18, 0)}px`,
      width: `${labelWidth}px`,
    }
  }

  useEffect(() => {
    if (!selectedTrickPlay) {
      setSelectedTrickLabelStyle(null)
      return
    }

    const surfaceElement = trickSurfaceRef.current
    const cardButtonElement = trickCardButtonRefs.current[selectedTrickCardIndex]

    if (!surfaceElement || !cardButtonElement) {
      setSelectedTrickLabelStyle(null)
      return
    }

    const updateSelectedTrickLabelStyle = () => {
      const surfaceRect = surfaceElement.getBoundingClientRect()
      const cardRect = cardButtonElement.getBoundingClientRect()
      const horizontalPadding = 12
      const maxLabelWidth = Math.max(surfaceRect.width - horizontalPadding * 2, 0)
      const estimatedLabelWidth = Math.min(maxLabelWidth, 224)
      const measuredLabelWidth = selectedTrickLabelRef.current?.scrollWidth ?? estimatedLabelWidth
      const labelWidth = Math.min(maxLabelWidth, measuredLabelWidth)
      const cardCenter = cardRect.left + (cardRect.width / 2)
      const centeredLeft = cardCenter - (labelWidth / 2)
      const centeredRight = cardCenter + (labelWidth / 2)
      const nextLabelStyle = {
        maxWidth: `${maxLabelWidth}px`,
      }
      const shouldEdgeAlign = labelWidth > cardRect.width

      if (shouldEdgeAlign && centeredLeft < surfaceRect.left + horizontalPadding) {
        const leftShift = Math.max((surfaceRect.left + horizontalPadding) - cardRect.left, 0)
        setSelectedTrickLabelStyle({
          ...nextLabelStyle,
          left: '0',
          textAlign: 'left',
          transform: `translateX(${leftShift}px)`,
        })
        return
      }

      if (shouldEdgeAlign && centeredRight > surfaceRect.right - horizontalPadding) {
        const rightShift = Math.min((surfaceRect.right - horizontalPadding) - cardRect.right, 0)
        setSelectedTrickLabelStyle({
          ...nextLabelStyle,
          left: '100%',
          textAlign: 'right',
          transform: `translateX(calc(-100% + ${rightShift}px))`,
        })
        return
      }

      setSelectedTrickLabelStyle({
        ...nextLabelStyle,
        left: '50%',
        textAlign: 'center',
        transform: 'translateX(-50%)',
      })
    }

    updateSelectedTrickLabelStyle()

    window.addEventListener('resize', updateSelectedTrickLabelStyle)
    surfaceElement.addEventListener('scroll', updateSelectedTrickLabelStyle, { passive: true })

    return () => {
      window.removeEventListener('resize', updateSelectedTrickLabelStyle)
      surfaceElement.removeEventListener('scroll', updateSelectedTrickLabelStyle)
    }
  }, [selectedTrickCardIndex, selectedTrickPlay, selectedTrickPlayerName, viewportWidth])

  useEffect(() => {
    const surfaceElement = trickSurfaceRef.current
    const useScatterTrickLayout = true

    if (!surfaceElement || displayedTrickPlays.length === 0 || useScatterTrickLayout) {
      setPassiveTrickLabelStyles((current) => (current.length === 0 ? current : []))
      return
    }

    let settleTimeoutId = null

    const updatePassiveTrickLabelStyles = () => {
      const nextStyles = displayedTrickPlays.map((_, index) =>
        selectedTrickCardIndex === index ? null : getPassiveTrickLabelStyle(surfaceElement, index),
      )

      setPassiveTrickLabelStyles((current) => {
        if (
          current.length === nextStyles.length &&
          current.every((style, index) => JSON.stringify(style) === JSON.stringify(nextStyles[index]))
        ) {
          return current
        }

        return nextStyles
      })
    }

    updatePassiveTrickLabelStyles()
    settleTimeoutId = window.setTimeout(updatePassiveTrickLabelStyles, 180)

    window.addEventListener('resize', updatePassiveTrickLabelStyles)
    surfaceElement.addEventListener('scroll', updatePassiveTrickLabelStyles, { passive: true })

    return () => {
      if (settleTimeoutId !== null) {
        clearTimeout(settleTimeoutId)
      }
      window.removeEventListener('resize', updatePassiveTrickLabelStyles)
      surfaceElement.removeEventListener('scroll', updatePassiveTrickLabelStyles)
    }
  }, [displayedTrickPlays, isMobileViewport, selectedTrickCardIndex, viewportWidth])

  const clearReturningTrickLabelAnimation = () => {
    if (returningTrickLabelFrameRef.current) {
      cancelAnimationFrame(returningTrickLabelFrameRef.current)
      returningTrickLabelFrameRef.current = null
    }

    if (returningTrickLabelTimeoutRef.current) {
      clearTimeout(returningTrickLabelTimeoutRef.current)
      returningTrickLabelTimeoutRef.current = null
    }
  }

  useEffect(() => () => {
    clearReturningTrickLabelAnimation()
  }, [])

  const animateReturningTrickLabel = (fromIndex) => {
    const surfaceElement = trickSurfaceRef.current
    const selectedLabelElement = selectedTrickLabelRef.current
    const trickPlay = displayedTrickPlays[fromIndex]
    const targetStyle = getPassiveTrickLabelStyle(surfaceElement, fromIndex)

    if (!surfaceElement || !selectedLabelElement || !trickPlay || !targetStyle) {
      setReturningTrickLabel(null)
      return
    }

    const surfaceRect = surfaceElement.getBoundingClientRect()
    const labelRect = selectedLabelElement.getBoundingClientRect()
    const text = getPassiveTrickPlayerLabel(
      getPlayerName(game, trickPlay.playerId),
      fromIndex,
      displayedTrickPlays.length,
    )
    const key = `${trickPlay.playerId}-${fromIndex}-${Date.now()}`

    clearReturningTrickLabelAnimation()
    setReturningTrickLabel({
      key,
      text,
      style: {
        left: `${labelRect.left - surfaceRect.left}px`,
        top: `${labelRect.top - surfaceRect.top}px`,
        width: `${labelRect.width}px`,
      },
    })

    returningTrickLabelFrameRef.current = requestAnimationFrame(() => {
      returningTrickLabelFrameRef.current = null
      setReturningTrickLabel({
        key,
        text,
        style: {
          ...targetStyle,
          transition: 'left 180ms ease, top 180ms ease, width 180ms ease',
        },
      })
    })

    returningTrickLabelTimeoutRef.current = setTimeout(() => {
      setReturningTrickLabel(null)
      returningTrickLabelTimeoutRef.current = null
    }, 220)
  }

  const handleSelectTrickCard = (index) => {
    if (bookWinnerMessage) {
      return
    }

    setSelectedTrickCardIndex((currentIndex) => {
      const nextIndex = currentIndex === index ? null : index

      if (currentIndex !== null && currentIndex !== nextIndex) {
        animateReturningTrickLabel(currentIndex)
      } else {
        clearReturningTrickLabelAnimation()
        setReturningTrickLabel(null)
      }

      return nextIndex
    })
  }

  useEffect(() => {
    previousCompletedTrickCountRef.current = completedTricks.length
    setBookWinnerMessage('')
    setRevealedCompletedTrick(null)

    if (bookWinnerTimeoutRef.current) {
      clearTimeout(bookWinnerTimeoutRef.current)
      bookWinnerTimeoutRef.current = null
    }
  }, [game?.id])

  useEffect(() => {
    const latestTrick = completedTricks[completedTricks.length - 1]
    const previousCompletedTrickCount = previousCompletedTrickCountRef.current

    if (completedTricks.length < previousCompletedTrickCount) {
      isHoldingTurnPlayerRef.current = false
      setBookWinnerMessage('')
      setRevealedCompletedTrick(null)
      setDisplayedTurnPlayerId(latestActualTurnPlayerIdRef.current)
      if (bookWinnerTimeoutRef.current) {
        clearTimeout(bookWinnerTimeoutRef.current)
        bookWinnerTimeoutRef.current = null
      }
    } else if (completedTricks.length > previousCompletedTrickCount && latestTrick?.winnerPlayerId) {
      isHoldingTurnPlayerRef.current = true
      setRevealedCompletedTrick(latestTrick)
      setBookWinnerMessage(
        latestTrick.winnerPlayerId === viewerPlayerId
          ? 'You won the book!'
          : `${getPlayerName(game, latestTrick.winnerPlayerId)} won the book.`,
      )
      if (bookWinnerTimeoutRef.current) {
        clearTimeout(bookWinnerTimeoutRef.current)
      }
      bookWinnerTimeoutRef.current = setTimeout(() => {
        isHoldingTurnPlayerRef.current = false
        setBookWinnerMessage('')
        setRevealedCompletedTrick(null)
        setDisplayedTurnPlayerId(latestActualTurnPlayerIdRef.current)
        bookWinnerTimeoutRef.current = null
      }, TRICK_COMPLETE_DELAY_MS)
    }

    previousCompletedTrickCountRef.current = completedTricks.length
  }, [completedTricks, game, game?.version, viewerPlayerId])

  useEffect(() => {
    return () => {
      if (bookWinnerTimeoutRef.current) {
        clearTimeout(bookWinnerTimeoutRef.current)
      }
      if (selectedTrickCardTimeoutRef.current) {
        clearTimeout(selectedTrickCardTimeoutRef.current)
      }
    }
  }, [])

  return {
    bookWinnerMessage,
    canSelectCards,
    displayedTrickPlays,
    displayedTurnPlayerId,
    floatingCelebrations,
    getPassiveTrickPlayerLabel,
    handleSelectTrickCard,
    isTrickWinnerRevealVisible,
    isViewerActualTurn,
    isViewerTurnVisible,
    leadTrickPlayerId,
    passiveTrickLabelStyles,
    returningTrickLabel,
    selectedCard,
    selectedCardIndex,
    selectedTrickCardIndex,
    selectedTrickLabelRef,
    selectedTrickLabelStyle,
    setSelectedCardIndex,
    trickCardButtonRefs,
    trickPlayCount,
    trickSurfaceRef,
  }
}
