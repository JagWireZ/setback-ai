import test from 'node:test'
import assert from 'node:assert/strict'

import { getRandomReactionPhrases, getReactionPhraseCategories } from '../src/utils/reactionPhrases.js'
import { REACTION_PHRASE_GROUPS } from '../shared/types/reactions.ts'

test('getReactionPhraseCategories returns groups in the fixed category order', () => {
  const categories = getReactionPhraseCategories()
  const expectedOrder = ['waiting', 'praise', 'fight', 'confident', 'brag', 'nervous', 'relief', 'frustrated', 'bidding']

  assert.deepEqual(categories.map((group) => group.id), expectedOrder)
  for (const group of categories) {
    assert.equal(group, REACTION_PHRASE_GROUPS.find((entry) => entry.id === group.id))
  }
})

test('getRandomReactionPhrases returns an empty array for an unknown category', () => {
  assert.deepEqual(getRandomReactionPhrases('not-a-real-category'), [])
})

test('getRandomReactionPhrases returns the requested count of phrases from the group', () => {
  const phrases = getRandomReactionPhrases('praise', 3, 42)
  const group = REACTION_PHRASE_GROUPS.find((entry) => entry.id === 'praise')

  assert.equal(phrases.length, 3)
  for (const phrase of phrases) {
    assert.ok(group.phrases.includes(phrase))
  }
})

test('getRandomReactionPhrases is deterministic for a given seed', () => {
  const first = getRandomReactionPhrases('waiting', 5, 7)
  const second = getRandomReactionPhrases('waiting', 5, 7)

  assert.deepEqual(first, second)
})

test('getRandomReactionPhrases clamps the count to the group size', () => {
  const group = REACTION_PHRASE_GROUPS.find((entry) => entry.id === 'bidding')
  const phrases = getRandomReactionPhrases('bidding', group.phrases.length + 50, 1)

  assert.equal(phrases.length, group.phrases.length)
  assert.deepEqual([...phrases].sort(), [...group.phrases].sort())
})
