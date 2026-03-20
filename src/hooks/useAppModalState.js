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

  const closeCreateModal = () => {
    setIsCreateModalOpen(false)
  }

  const closeJoinModal = () => {
    setIsJoinModalOpen(false)
  }

  const closeSubmitBidModal = () => {
    setIsBidModalOpen(false)
    setSelectedBid('0')
  }

  const closeLobbyRemovePlayerConfirm = () => {
    setPendingLobbyRemovePlayer(null)
    if (removePlayerTimerRef.current) {
      window.clearTimeout(removePlayerTimerRef.current)
      removePlayerTimerRef.current = null
    }
  }

  const closeLobbyRemoveSeatConfirm = () => {
    setPendingLobbyRemoveSeat(null)
    if (removeSeatTimerRef.current) {
      window.clearTimeout(removeSeatTimerRef.current)
      removeSeatTimerRef.current = null
    }
  }

  const closeLobbyRenamePlayerModal = () => {
    setPendingLobbyRenamePlayer(null)
    setLobbyRenameDraft('')
    if (renamePlayerTimerRef.current) {
      window.clearTimeout(renamePlayerTimerRef.current)
      renamePlayerTimerRef.current = null
    }
  }

  const openLobbyRemovePlayerConfirm = (player) => {
    if (!player) {
      return
    }

    if (removePlayerTimerRef.current) {
      window.clearTimeout(removePlayerTimerRef.current)
    }

    removePlayerTimerRef.current = window.setTimeout(() => {
      setPendingLobbyRemovePlayer({
        id: player.id,
        name: player.name,
      })
      removePlayerTimerRef.current = null
    }, 0)
  }

  const openLobbyRemoveSeatConfirm = (player) => {
    if (!player) {
      return
    }

    if (removeSeatTimerRef.current) {
      window.clearTimeout(removeSeatTimerRef.current)
    }

    removeSeatTimerRef.current = window.setTimeout(() => {
      setPendingLobbyRemoveSeat({
        id: player.id,
        name: player.name,
      })
      removeSeatTimerRef.current = null
    }, 0)
  }

  const openLobbyRenamePlayerModal = (player) => {
    if (!player) {
      return
    }

    if (renamePlayerTimerRef.current) {
      window.clearTimeout(renamePlayerTimerRef.current)
    }

    renamePlayerTimerRef.current = window.setTimeout(() => {
      setPendingLobbyRenamePlayer({
        id: player.id,
        name: player.name,
      })
      setLobbyRenameDraft(player.name)
      renamePlayerTimerRef.current = null
    }, 0)
  }

  return {
    isCreateModalOpen,
    setIsCreateModalOpen,
    isJoinModalOpen,
    setIsJoinModalOpen,
    isBidModalOpen,
    setIsBidModalOpen,
    isLobbyShareModalOpen,
    setIsLobbyShareModalOpen,
    isHelpModalOpen,
    setIsHelpModalOpen,
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
    closeJoinModal,
    closeSubmitBidModal,
    openLobbyRemovePlayerConfirm,
    closeLobbyRemovePlayerConfirm,
    openLobbyRemoveSeatConfirm,
    closeLobbyRemoveSeatConfirm,
    openLobbyRenamePlayerModal,
    closeLobbyRenamePlayerModal,
  }
}
