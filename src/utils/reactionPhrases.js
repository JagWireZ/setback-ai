import { REACTION_PHRASE_GROUPS } from '../../shared/types/reactions'

const TURN_AWARE_PHASE_CATEGORY_ORDER = {
  Bidding: {
    active: ['nervous', 'confident', 'bluff'],
    waiting: ['waiting', 'bidding'],
  },
  Playing: {
    active: ['brag', 'relief', 'bluff'],
    waiting: ['waiting', 'praise', 'fight'],
  },
}

const PHASE_CATEGORY_ORDER = {
  Lobby: ['fight', 'bluff', 'praise'],
  Dealing: ['waiting', 'bluff'],
  Scoring: ['praise', 'brag', 'relief', 'fight'],
  EndOfRound: ['praise', 'brag', 'relief', 'fight'],
  GameOver: ['praise', 'brag', 'fight'],
}

const DEFAULT_CATEGORY_ORDER = ['waiting', 'praise', 'fight', 'brag', 'relief', 'bluff']

const shuffle = (items, seed) => {
  const nextItems = [...items]
  let currentSeed = seed || 1

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    currentSeed = (currentSeed * 1664525 + 1013904223) >>> 0
    const swapIndex = currentSeed % (index + 1)
    ;[nextItems[index], nextItems[swapIndex]] = [nextItems[swapIndex], nextItems[index]]
  }

  return nextItems
}

export const getReactionPhraseCategories = (game, viewerPlayerId) => {
  const phaseStage = game?.phase?.stage
  const turnPlayerId = game?.phase?.turnPlayerId
  const isViewerTurn = Boolean(viewerPlayerId) && turnPlayerId === viewerPlayerId
  const turnAwareOrder = TURN_AWARE_PHASE_CATEGORY_ORDER[phaseStage]
  const order =
    turnAwareOrder
      ? (isViewerTurn ? turnAwareOrder.active : turnAwareOrder.waiting)
      : (PHASE_CATEGORY_ORDER[phaseStage] ?? DEFAULT_CATEGORY_ORDER)
  const groupById = new Map(REACTION_PHRASE_GROUPS.map((group) => [group.id, group]))
  return order.map((id) => groupById.get(id)).filter(Boolean)
}

export const getRandomReactionPhrases = (categoryId, count = 3, seed = Date.now()) => {
  const group = REACTION_PHRASE_GROUPS.find((entry) => entry.id === categoryId)
  if (!group) {
    return []
  }

  return shuffle(group.phrases, seed).slice(0, Math.min(count, group.phrases.length))
}
