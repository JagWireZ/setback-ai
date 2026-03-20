import { useEffect, useRef, useState } from 'react'

export function useAppModalState() {
  const [activeHomeModal, setActiveHomeModal] = useState(null)
  const [isBidModalOpen, setIsBidModalOpen] = useState(false)
  const [isLobbyShareModalOpen, setIsLobbyShareModalOpen] = useState(false)
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false)
  const [showAwayContinueModal, setShowAwayContinueModal] = useState(false)
  const [isEndOfRoundModalDismissed, setIsEndOfRoundModalDismissed] = useState(false)
  const [isShareLinkCopied, setIsShareLinkCopied] = useState(false)
  const [shareQrCodeDataUrl, setShareQrCodeDataUrl] = useState('')
  const [selectedBid, setSelectedBid] = useState('0')
  const [helpSection, setHelpSection] = useState('how-to-play')
  const [lobbyPlayerModal, setLobbyPlayerModal] = useState({
    type: null,
    player: null,
    draft: '',
  })

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
    setActiveHomeModal('create')
  }

  const closeCreateModal = () => {
    setActiveHomeModal((current) => (current === 'create' ? null : current))
  }

  const openJoinModal = () => {
    setActiveHomeModal('join')
  }

  const closeJoinModal = () => {
    setActiveHomeModal((current) => (current === 'join' ? null : current))
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

  const clearPendingLobbyAction = (timerRef, modalType) => {
    setLobbyPlayerModal((current) => (
      current.type === modalType
        ? { type: null, player: null, draft: '' }
        : current
    ))
    if (!timerRef.current) {
      return
    }

    window.clearTimeout(timerRef.current)
    timerRef.current = null
  }

  const closeLobbyRemovePlayerConfirm = () => {
    clearPendingLobbyAction(removePlayerTimerRef, 'remove-player')
  }

  const closeLobbyRemoveSeatConfirm = () => {
    clearPendingLobbyAction(removeSeatTimerRef, 'remove-seat')
  }

  const closeLobbyRenamePlayerModal = () => {
    clearPendingLobbyAction(renamePlayerTimerRef, 'rename-player')
  }

  const scheduleLobbyPlayerModal = ({
    modalType,
    player,
    timerRef,
  }) => {
    if (!player) {
      return
    }

    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
    }

    timerRef.current = window.setTimeout(() => {
      setLobbyPlayerModal({
        type: modalType,
        player: {
          id: player.id,
          name: player.name,
        },
        draft: modalType === 'rename-player' ? player.name : '',
      })
      timerRef.current = null
    }, 0)
  }

  const openLobbyRemovePlayerConfirm = (player) => {
    scheduleLobbyPlayerModal({
      modalType: 'remove-player',
      player,
      timerRef: removePlayerTimerRef,
    })
  }

  const openLobbyRemoveSeatConfirm = (player) => {
    scheduleLobbyPlayerModal({
      modalType: 'remove-seat',
      player,
      timerRef: removeSeatTimerRef,
    })
  }

  const openLobbyRenamePlayerModal = (player) => {
    scheduleLobbyPlayerModal({
      modalType: 'rename-player',
      player,
      timerRef: renamePlayerTimerRef,
    })
  }

  return {
    awayContinue: {
      isOpen: showAwayContinueModal,
      setIsOpen: setShowAwayContinueModal,
    },
    bid: {
      close: closeSubmitBidModal,
      isOpen: isBidModalOpen,
      selectedBid,
      setIsOpen: setIsBidModalOpen,
      setSelectedBid,
    },
    endOfRound: {
      isDismissed: isEndOfRoundModalDismissed,
      setIsDismissed: setIsEndOfRoundModalDismissed,
    },
    help: {
      close: closeHelpModal,
      isOpen: isHelpModalOpen,
      open: openHelpModal,
      section: helpSection,
      setSection: setHelpSection,
    },
    homeSession: {
      active: activeHomeModal,
      closeCreate: closeCreateModal,
      closeJoin: closeJoinModal,
      isCreateOpen: activeHomeModal === 'create',
      isJoinOpen: activeHomeModal === 'join',
      openCreate: openCreateModal,
      openJoin: openJoinModal,
    },
    lobbyPlayer: {
      closeRemovePlayerConfirm: closeLobbyRemovePlayerConfirm,
      closeRemoveSeatConfirm: closeLobbyRemoveSeatConfirm,
      closeRenameModal: closeLobbyRenamePlayerModal,
      openRemovePlayerConfirm: openLobbyRemovePlayerConfirm,
      openRemoveSeatConfirm: openLobbyRemoveSeatConfirm,
      openRenameModal: openLobbyRenamePlayerModal,
      pendingRemovePlayer: lobbyPlayerModal.type === 'remove-player' ? lobbyPlayerModal.player : null,
      pendingRemoveSeat: lobbyPlayerModal.type === 'remove-seat' ? lobbyPlayerModal.player : null,
      pendingRenamePlayer: lobbyPlayerModal.type === 'rename-player' ? lobbyPlayerModal.player : null,
      renameDraft: lobbyPlayerModal.type === 'rename-player' ? lobbyPlayerModal.draft : '',
      setRenameDraft: (value) => {
        setLobbyPlayerModal((current) => (
          current.type === 'rename-player'
            ? { ...current, draft: value }
            : current
        ))
      },
    },
    share: {
      closeLobby: closeLobbyShareModal,
      isLinkCopied: isShareLinkCopied,
      isLobbyOpen: isLobbyShareModalOpen,
      openLobby: openLobbyShareModal,
      qrCodeDataUrl: shareQrCodeDataUrl,
      setIsLinkCopied: setIsShareLinkCopied,
      setQrCodeDataUrl: setShareQrCodeDataUrl,
    },
  }
}
