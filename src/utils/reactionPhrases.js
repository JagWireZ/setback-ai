import { REACTION_PHRASE_GROUPS } from '../../shared/types/reactions'

const CATEGORY_ORDER = ['waiting', 'praise', 'fight', 'confident', 'brag', 'nervous', 'relief', 'frustrated', 'bidding']

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

export const getReactionPhraseCategories = () => {
  const groupById = new Map(REACTION_PHRASE_GROUPS.map((group) => [group.id, group]))
  return CATEGORY_ORDER.map((id) => groupById.get(id)).filter(Boolean)
}

export const getRandomReactionPhrases = (categoryId, count = 3, seed = Date.now()) => {
  const group = REACTION_PHRASE_GROUPS.find((entry) => entry.id === categoryId)
  if (!group) {
    return []
  }

  return shuffle(group.phrases, seed).slice(0, Math.min(count, group.phrases.length))
}
