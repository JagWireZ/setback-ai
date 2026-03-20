import { useEffect, useRef, useState } from 'react'

export function useAppModalState() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false)
  const [isBidModalOpen, setIsBidModalOpen] = useState(false)
  const [isLobbyShareModalOpen, setIsLobbyShareModalOpen] = useState(false)
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false)
  const [showAwayContinueModal, setShowAwayContinueModal] = useState(false)
  const [isEndOfRoundModalDismissed, setIsEndOfRoundModalDismissed] = useState(false)
  const [isShareLinkCopied, setIsShareLinkCopied] = useState(false)
  const [shareQrCodeDataUrl, setShareQrCodeDataUrl] = useState('')
  const [selectedBid, setSelectedBid] = useState('0')
  const [helpSection, setHelpSection] = useState('how-to-play')
  const [pendingLobbyRemovePlayer, setPendingLobbyRemovePlayer] = useState(null)
  const [pendingLobbyRemoveSeat, setPendingLobbyRemoveSeat] = useState(null)
  const [pendingLobbyRenamePlayer, setPendingLobbyRenamePlayer] = useState(null)
  const [lobbyRenameDraft, setLobbyRenameDraft] = useState('')

  const removePlayerTimerRef = useRef(null)
  const removeSeatTimerRef = useRef(null)
  const renamePlayerTimerRef = useRef(null)

  useEffect(() => () => {
    if (removePlayerTimerRef.current) {
      window.clearTimeout(removePlayerTimerRef.current)
    }
    if (removeSeatTimerRef.current) {
      window.clearTimeout(removeSeatTimerRef.current)
    }
    if (renamePlayerTimerRef.current) {
      window.clearTimeout(renamePlayerTimerRef.current)
    }
  }, [])

  const openCreateModal = () => {
    setIsJoinModalOpen(false)
    setIsCreateModalOpen(true)
  }

  const closeCreateModal = () => {
    setIsCreateModalOpen(false)
  }

  const openJoinModal = () => {
    setIsCreateModalOpen(false)
    setIsJoinModalOpen(true)
  }

  const closeJoinModal = () => {
    setIsJoinModalOpen(false)
  }

  const openHelpModal = () => {
    setIsHelpModalOpen(true)
  }

  const closeHelpModal = () => {
    setIsHelpModalOpen(false)
  }

  const openLobbyShareModal = () => {
    setIsLobbyShareModalOpen(true)
  }

  const closeLobbyShareModal = () => {
    setIsLobbyShareModalOpen(false)
  }

  const closeSubmitBidModal = () => {
    setIsBidModalOpen(false)
    setSelectedBid('0')
  }

  const clearPendingLobbyAction = (timerRef, clearPendingState) => {
    clearPendingState(null)
    if (!timerRef.current) {
      return
    }

    window.clearTimeout(timerRef.current)
    timerRef.current = null
  }

  const closeLobbyRemovePlayerConfirm = () => {
    clearPendingLobbyAction(removePlayerTimerRef, setPendingLobbyRemovePlayer)
  }

  const closeLobbyRemoveSeatConfirm = () => {
    clearPendingLobbyAction(removeSeatTimerRef, setPendingLobbyRemoveSeat)
  }

  const closeLobbyRenamePlayerModal = () => {
    clearPendingLobbyAction(renamePlayerTimerRef, setPendingLobbyRenamePlayer)
    setLobbyRenameDraft('')
  }

  const scheduleLobbyPlayerModal = ({
    player,
    timerRef,
    setPendingState,
    onOpen,
  }) => {
    if (!player) {
      return
    }

    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
    }

    timerRef.current = window.setTimeout(() => {
      setPendingState({
        id: player.id,
        name: player.name,
      })
      onOpen?.(player)
      timerRef.current = null
    }, 0)
  }

  const openLobbyRemovePlayerConfirm = (player) => {
    scheduleLobbyPlayerModal({
      player,
      timerRef: removePlayerTimerRef,
      setPendingState: setPendingLobbyRemovePlayer,
    })
  }

  const openLobbyRemoveSeatConfirm = (player) => {
    scheduleLobbyPlayerModal({
      player,
      timerRef: removeSeatTimerRef,
      setPendingState: setPendingLobbyRemoveSeat,
    })
  }

  const openLobbyRenamePlayerModal = (player) => {
    scheduleLobbyPlayerModal({
      player,
      timerRef: renamePlayerTimerRef,
      setPendingState: setPendingLobbyRenamePlayer,
      onOpen: (nextPlayer) => {
        setLobbyRenameDraft(nextPlayer.name)
      },
    })
  }

  return {
    isCreateModalOpen,
    openCreateModal,
    isJoinModalOpen,
    openJoinModal,
    isBidModalOpen,
    setIsBidModalOpen,
    isLobbyShareModalOpen,
    openLobbyShareModal,
    isHelpModalOpen,
    openHelpModal,
    showAwayContinueModal,
    setShowAwayContinueModal,
    isEndOfRoundModalDismissed,
    setIsEndOfRoundModalDismissed,
    isShareLinkCopied,
    setIsShareLinkCopied,
    shareQrCodeDataUrl,
    setShareQrCodeDataUrl,
    selectedBid,
    setSelectedBid,
    helpSection,
    setHelpSection,
    pendingLobbyRemovePlayer,
    pendingLobbyRemoveSeat,
    pendingLobbyRenamePlayer,
    lobbyRenameDraft,
    setLobbyRenameDraft,
    closeCreateModal,
    closeHelpModal,
    closeJoinModal,
    closeLobbyShareModal,
    closeSubmitBidModal,
    openLobbyRemovePlayerConfirm,
    closeLobbyRemovePlayerConfirm,
    openLobbyRemoveSeatConfirm,
    closeLobbyRemoveSeatConfirm,
    openLobbyRenamePlayerModal,
    closeLobbyRenamePlayerModal,
  }
}
