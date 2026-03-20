import { useEffect, useMemo, useRef, useState } from 'react'
import { truncateLabel } from '../utils/playerName'

export function useGameTableModalState({
  bookWinnerMessage,
  currentPlayerName,
  gamePlayers,
  isGameOver,
  isMenuModalOpen,
  orderedPlayers,
}) {
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [isResetConfirmModalOpen, setIsResetConfirmModalOpen] = useState(false)
  const [isLeaveConfirmModalOpen, setIsLeaveConfirmModalOpen] = useState(false)
  const [isEditingPlayerName, setIsEditingPlayerName] = useState(false)
  const [selectedScorePlayerId, setSelectedScorePlayerId] = useState('')
  const [pendingRemovePlayer, setPendingRemovePlayer] = useState(null)
  const [scorePlayerNameDraft, setScorePlayerNameDraft] = useState('')
  const [editedPlayerName, setEditedPlayerName] = useState('')
  const hasAutoOpenedGameOverScoreRef = useRef(false)

  const selectedScorePlayer = useMemo(
    () =>
      orderedPlayers.find((player) => player.id === selectedScorePlayerId) ??
      gamePlayers?.find((player) => player.id === selectedScorePlayerId) ??
      null,
    [gamePlayers, orderedPlayers, selectedScorePlayerId],
  )

  useEffect(() => {
    if (!isMenuModalOpen) {
      setIsEditingPlayerName(false)
      setEditedPlayerName(currentPlayerName)
      return
    }

    if (!isEditingPlayerName) {
      setEditedPlayerName(currentPlayerName)
    }
  }, [currentPlayerName, isEditingPlayerName, isMenuModalOpen])

  useEffect(() => {
    if (!selectedScorePlayerId) {
      return
    }

    if (!selectedScorePlayer) {
      setSelectedScorePlayerId('')
      setScorePlayerNameDraft('')
      return
    }

    setScorePlayerNameDraft(selectedScorePlayer.name)
  }, [selectedScorePlayer?.name, selectedScorePlayerId])

  useEffect(() => {
    if (isGameOver && !bookWinnerMessage && !hasAutoOpenedGameOverScoreRef.current) {
      setIsScoreModalOpen(true)
      hasAutoOpenedGameOverScoreRef.current = true
    }

    if (!isGameOver) {
      hasAutoOpenedGameOverScoreRef.current = false
    }
  }, [bookWinnerMessage, isGameOver])

  const closeScorePlayerModal = () => {
    setSelectedScorePlayerId('')
    setScorePlayerNameDraft('')
  }

  const openRemovePlayerConfirm = (player) => {
    if (!player) {
      return
    }

    setPendingRemovePlayer({
      id: player.id,
      name: player.name,
    })
  }

  const closeRemovePlayerConfirm = () => {
    setPendingRemovePlayer(null)
  }

  return {
    closeRemovePlayerConfirm,
    closeScorePlayerModal,
    editedPlayerName,
    isEditingPlayerName,
    isHistoryModalOpen,
    isLeaveConfirmModalOpen,
    isResetConfirmModalOpen,
    isScoreModalOpen,
    openRemovePlayerConfirm,
    pendingRemovePlayer,
    scorePlayerNameDraft,
    selectedScorePlayer,
    selectedScorePlayerId,
    setEditedPlayerName,
    setIsEditingPlayerName,
    setIsHistoryModalOpen,
    setIsLeaveConfirmModalOpen,
    setIsResetConfirmModalOpen,
    setIsScoreModalOpen,
    setScorePlayerNameDraft,
    setSelectedScorePlayerId,
    shortenedMenuPlayerName: truncateLabel(currentPlayerName, 18),
  }
}
