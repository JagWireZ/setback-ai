import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { hashString } from '../utils/gameUi'
import { getRandomReactionPhrases, getReactionPhraseCategories } from '../utils/reactionPhrases'

export function useGameTableState({
  menuCloseRequestKey = 0,
  onSetGameError,
  shareLink,
  trickPhraseSeed,
}) {
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 1024 : window.innerWidth,
  )
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [shareQrCodeDataUrl, setShareQrCodeDataUrl] = useState('')
  const [isReactionModalOpen, setIsReactionModalOpen] = useState(false)
  const [selectedReactionPhraseCategoryId, setSelectedReactionPhraseCategoryId] = useState('')
  const [reactionPhraseOptions, setReactionPhraseOptions] = useState([])
  const [reactionModalPosition, setReactionModalPosition] = useState({ right: 16, bottom: 16 })
  const reactionPickerRef = useRef(null)

  const isMobileViewport = viewportWidth < 640
  const reactionPhraseCategories = useMemo(() => getReactionPhraseCategories(), [])

  useEffect(() => {
    if (menuCloseRequestKey > 0) {
      setIsMenuModalOpen(false)
    }
  }, [menuCloseRequestKey])

  useEffect(() => {
    let isCancelled = false

    if (!isShareModalOpen || !shareLink) {
      setShareQrCodeDataUrl('')
      return undefined
    }

    QRCode.toDataURL(shareLink, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
      color: {
        dark: '#0f172a',
        light: '#f8fafc',
      },
    })
      .then((url) => {
        if (!isCancelled) {
          setShareQrCodeDataUrl(url)
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setShareQrCodeDataUrl('')
          onSetGameError?.('Unable to generate QR code.')
        }
      })

    return () => {
      isCancelled = true
    }
  }, [isShareModalOpen, onSetGameError, shareLink])

  useEffect(() => {
    if (!isReactionModalOpen) {
      return
    }

    const hasActiveCategory = reactionPhraseCategories.some((category) => category.id === selectedReactionPhraseCategoryId)
    if (hasActiveCategory && reactionPhraseOptions.length > 0) {
      return
    }

    const activeCategoryId = hasActiveCategory
      ? selectedReactionPhraseCategoryId
      : (reactionPhraseCategories[0]?.id ?? '')
    const nextOptions = getRandomReactionPhrases(activeCategoryId, 3, hashString(`${activeCategoryId}:${trickPhraseSeed}`))

    if (selectedReactionPhraseCategoryId !== activeCategoryId) {
      setSelectedReactionPhraseCategoryId(activeCategoryId)
    }

    setReactionPhraseOptions((current) => {
      if (
        current.length === nextOptions.length &&
        current.every((phrase, index) => phrase === nextOptions[index])
      ) {
        return current
      }

      return nextOptions
    })
  }, [isReactionModalOpen, reactionPhraseCategories, reactionPhraseOptions.length, selectedReactionPhraseCategoryId, trickPhraseSeed])

  useEffect(() => {
    if (!isReactionModalOpen || typeof window === 'undefined') {
      return undefined
    }

    const updateReactionModalPosition = () => {
      const pickerBounds = reactionPickerRef.current?.getBoundingClientRect()
      if (!pickerBounds) {
        return
      }

      const nextPosition = {
        right: Math.max(16, window.innerWidth - pickerBounds.right),
        bottom: Math.max(16, window.innerHeight - pickerBounds.top + 12),
      }

      setReactionModalPosition((current) =>
        current.right === nextPosition.right && current.bottom === nextPosition.bottom
          ? current
          : nextPosition,
      )
    }

    updateReactionModalPosition()
    window.addEventListener('resize', updateReactionModalPosition)

    return () => {
      window.removeEventListener('resize', updateReactionModalPosition)
    }
  }, [isMobileViewport, isReactionModalOpen])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const handleResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    if (!isReactionModalOpen || typeof window === 'undefined') {
      return undefined
    }

    const handlePointerDown = (event) => {
      if (reactionPickerRef.current?.contains(event.target)) {
        return
      }

      setIsReactionModalOpen(false)
    }

    window.addEventListener('pointerdown', handlePointerDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isReactionModalOpen])

  const handleReactionCategorySelect = (categoryId) => {
    setSelectedReactionPhraseCategoryId(categoryId)
    setReactionPhraseOptions(
      getRandomReactionPhrases(categoryId, 3, hashString(`${categoryId}:${trickPhraseSeed}`)),
    )
  }

  return {
    handleReactionCategorySelect,
    isMenuModalOpen,
    isMobileViewport,
    isReactionModalOpen,
    isShareModalOpen,
    reactionModalPosition,
    reactionPhraseCategories,
    reactionPhraseOptions,
    reactionPickerRef,
    selectedReactionPhraseCategoryId,
    setIsMenuModalOpen,
    setIsReactionModalOpen,
    setIsShareModalOpen,
    shareQrCodeDataUrl,
    viewportWidth,
  }
}
