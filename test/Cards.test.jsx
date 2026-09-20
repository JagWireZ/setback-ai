import test from 'node:test'
import assert from 'node:assert/strict'
import '../test/setupDom.js'
import { render, screen, cleanup } from '@testing-library/react'

import { CardAsset, CardBack } from '../src/components/Cards.jsx'

test.afterEach(() => {
  cleanup()
})

test('CardAsset renders the rank and suit for a standard card', () => {
  render(<CardAsset card={{ rank: 'K', suit: 'Hearts' }} />)

  const image = screen.getByRole('img', { name: 'K of Hearts' })
  assert.ok(image)
})

test('CardAsset renders joker accent text', () => {
  render(<CardAsset card={{ rank: 'BJ', suit: 'Joker' }} />)

  assert.ok(screen.getByRole('img', { name: 'Big Joker' }))
  assert.ok(screen.getByText('BIG'))
})

test('CardAsset falls back to "Unknown card" label when card is missing', () => {
  render(<CardAsset card={undefined} />)

  assert.ok(screen.getByRole('img', { name: 'Unknown card' }))
})

test('CardBack renders a face-down deck placeholder', () => {
  render(<CardBack />)

  assert.ok(screen.getByRole('img', { name: 'Face-down deck' }))
})
