import test from 'node:test'
import assert from 'node:assert/strict'
import '../test/setupDom.js'
import { renderHook, act, cleanup } from '@testing-library/react'

import { useGameTableState } from '../src/hooks/useGameTableState.js'

test.afterEach(() => {
  cleanup()
})

const setViewportWidth = (width) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
}

const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 300)))

test('isMobileViewport reflects the initial window width', () => {
  setViewportWidth(400)
  const { result: mobileResult } = renderHook(() => useGameTableState({}))
  assert.equal(mobileResult.current.isMobileViewport, true)
  cleanup()

  setViewportWidth(1200)
  const { result: desktopResult } = renderHook(() => useGameTableState({}))
  assert.equal(desktopResult.current.isMobileViewport, false)
})

test('viewportWidth updates when the window resizes', () => {
  setViewportWidth(1024)
  const { result } = renderHook(() => useGameTableState({}))

  act(() => {
    setViewportWidth(500)
    window.dispatchEvent(new window.Event('resize'))
  })

  assert.equal(result.current.viewportWidth, 500)
  assert.equal(result.current.isMobileViewport, true)
})

test('menuCloseRequestKey increments close the menu modal', () => {
  const { result, rerender } = renderHook((props) => useGameTableState(props), {
    initialProps: { menuCloseRequestKey: 0 },
  })

  act(() => result.current.setIsMenuModalOpen(true))
  assert.equal(result.current.isMenuModalOpen, true)

  rerender({ menuCloseRequestKey: 1 })
  assert.equal(result.current.isMenuModalOpen, false)
})

test('opening the share modal generates a QR code data URL for the share link', async () => {
  const { result, rerender } = renderHook((props) => useGameTableState(props), {
    initialProps: { shareLink: 'https://example.com/game/1' },
  })

  act(() => result.current.setIsShareModalOpen(true))
  rerender({ shareLink: 'https://example.com/game/1' })

  await flush()

  assert.ok(result.current.shareQrCodeDataUrl.startsWith('data:image/'))
})

test('closing the share modal clears the QR code', async () => {
  const { result, rerender } = renderHook((props) => useGameTableState(props), {
    initialProps: { shareLink: 'https://example.com/game/1' },
  })

  act(() => result.current.setIsShareModalOpen(true))
  rerender({ shareLink: 'https://example.com/game/1' })
  await flush()
  assert.ok(result.current.shareQrCodeDataUrl)

  act(() => result.current.setIsShareModalOpen(false))
  assert.equal(result.current.shareQrCodeDataUrl, '')
})

test('opening the share modal without a share link reports an error via onSetGameError', async () => {
  const onSetGameError = () => {}
  const { result } = renderHook(() => useGameTableState({ shareLink: '', onSetGameError }))

  act(() => result.current.setIsShareModalOpen(true))
  await flush()

  assert.equal(result.current.shareQrCodeDataUrl, '')
})

test('opening the reaction modal seeds a default category and phrase options deterministically', () => {
  const { result } = renderHook(() => useGameTableState({ trickPhraseSeed: 42 }))

  act(() => result.current.setIsReactionModalOpen(true))

  assert.ok(result.current.selectedReactionPhraseCategoryId)
  assert.equal(result.current.reactionPhraseOptions.length, 3)
})

test('handleReactionCategorySelect switches categories and refreshes phrase options', () => {
  const { result } = renderHook(() => useGameTableState({ trickPhraseSeed: 1 }))

  act(() => result.current.setIsReactionModalOpen(true))
  const firstCategory = result.current.selectedReactionPhraseCategoryId

  const otherCategory = result.current.reactionPhraseCategories.find((category) => category.id !== firstCategory)
  act(() => result.current.handleReactionCategorySelect(otherCategory.id))

  assert.equal(result.current.selectedReactionPhraseCategoryId, otherCategory.id)
  assert.equal(result.current.reactionPhraseOptions.length, 3)
})

test('a pointerdown outside the reaction picker closes the reaction modal', () => {
  const { result } = renderHook(() => useGameTableState({}))

  act(() => result.current.setIsReactionModalOpen(true))
  assert.equal(result.current.isReactionModalOpen, true)

  act(() => {
    const outsideElement = document.createElement('div')
    document.body.appendChild(outsideElement)
    result.current.reactionPickerRef.current = document.createElement('div')
    outsideElement.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true }))
  })

  assert.equal(result.current.isReactionModalOpen, false)
})
