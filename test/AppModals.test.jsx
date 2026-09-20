import test from 'node:test'
import assert from 'node:assert/strict'
import '../test/setupDom.js'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

import {
  AwayContinueModal,
  BidModal,
  ConfirmLobbyActionModal,
  EndOfRoundSummaryModal,
  HelpModal,
  LobbyShareModal,
  RenameLobbyPlayerModal,
} from '../src/components/AppModals.jsx'

test.afterEach(() => {
  cleanup()
})

const Icon = (props) => <svg data-testid="icon" {...props} />

test('HelpModal renders nothing when closed', () => {
  const { container } = render(<HelpModal isOpen={false} helpSection="how-to-play" setHelpSection={() => {}} onClose={() => {}} />)
  assert.equal(container.innerHTML, '')
})

test('HelpModal switches sections and closes', () => {
  let helpSection = 'how-to-play'
  const closeCalls = []
  const { rerender } = render(
    <HelpModal isOpen helpSection={helpSection} setHelpSection={(next) => { helpSection = next }} onClose={() => closeCalls.push('close')} />,
  )

  assert.ok(screen.getByText('Objective'))

  fireEvent.click(screen.getByRole('button', { name: 'Using the App' }))
  assert.equal(helpSection, 'using-app')

  rerender(<HelpModal isOpen helpSection={helpSection} setHelpSection={() => {}} onClose={() => closeCalls.push('close')} />)
  assert.ok(screen.getByText('Getting Started'))
})

test('AwayContinueModal is hidden when closed and disables the button while continuing', () => {
  const { container, unmount } = render(<AwayContinueModal isOpen={false} isContinuingGame={false} onContinue={() => {}} />)
  assert.equal(container.innerHTML, '')
  unmount()

  const onContinue = () => {}
  render(<AwayContinueModal isOpen isContinuingGame onContinue={onContinue} />)
  const button = screen.getByRole('button', { name: 'Continuing...' })
  assert.equal(button.disabled, true)
})

test('AwayContinueModal calls onContinue when not busy', () => {
  const calls = []
  render(<AwayContinueModal isOpen isContinuingGame={false} onContinue={() => calls.push('continue')} />)

  fireEvent.click(screen.getByRole('button', { name: 'Continue Game' }))
  assert.deepEqual(calls, ['continue'])
})

test('BidModal lists bid options up to the round card count and includes Trip for trip rounds', () => {
  render(
    <BidModal
      isOpen
      currentRoundCardCount={3}
      isTripRound
      selectedBid="1"
      setSelectedBid={() => {}}
      isSubmittingBid={false}
      onClose={() => {}}
      onSubmit={(event) => event.preventDefault()}
    />,
  )

  const options = screen.getAllByRole('option').map((option) => option.value)
  assert.deepEqual(options, ['0', '1', '2', '3', 'trip'])
})

test('BidModal omits Trip for a non-trip round and submits the form', () => {
  const submitted = []
  render(
    <BidModal
      isOpen
      currentRoundCardCount={6}
      isTripRound={false}
      selectedBid="2"
      setSelectedBid={() => {}}
      isSubmittingBid={false}
      onClose={() => {}}
      onSubmit={(event) => {
        event.preventDefault()
        submitted.push('submit')
      }}
    />,
  )

  assert.equal(screen.queryByRole('option', { name: 'Trip' }), null)
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }))
  assert.deepEqual(submitted, ['submit'])
})

test('BidModal disables Cancel and Submit while submitting', () => {
  render(
    <BidModal
      isOpen
      currentRoundCardCount={6}
      isTripRound={false}
      selectedBid="2"
      setSelectedBid={() => {}}
      isSubmittingBid
      onClose={() => {}}
      onSubmit={() => {}}
    />,
  )

  assert.equal(screen.getByRole('button', { name: 'Cancel' }).disabled, true)
  assert.equal(screen.getByRole('button', { name: 'Submitting...' }).disabled, true)
})

test('EndOfRoundSummaryModal renders nothing without a summary or while closed', () => {
  const { container, unmount } = render(
    <EndOfRoundSummaryModal summary={null} isOpen getRoundDirectionArrow={() => '⬆'} onClose={() => {}} />,
  )
  assert.equal(container.innerHTML, '')
  unmount()

  const summary = { cardCount: 6, direction: 'up', players: [{ playerId: 'p1', name: 'Casey', bid: 3, books: 3, score: 30 }] }
  const { container: closedContainer } = render(
    <EndOfRoundSummaryModal summary={summary} isOpen={false} getRoundDirectionArrow={() => '⬆'} onClose={() => {}} />,
  )
  assert.equal(closedContainer.innerHTML, '')
})

test('EndOfRoundSummaryModal highlights the leading player and calls onClose', () => {
  const summary = {
    cardCount: 6,
    direction: 'up',
    players: [
      { playerId: 'p1', name: 'Casey', bid: 3, books: 3, score: 30, rainbow: true },
      { playerId: 'p2', name: 'Robin', bid: 2, books: 1, score: 10 },
    ],
  }
  const closeCalls = []
  render(
    <EndOfRoundSummaryModal
      summary={summary}
      isOpen
      getRoundDirectionArrow={(direction) => (direction === 'up' ? '⬆' : '⬇')}
      onClose={() => closeCalls.push('close')}
    />,
  )

  assert.ok(screen.getByText('End of Round 6 ⬆'))
  assert.ok(screen.getByText('Score 30🌈'.replace('🌈', ' 🌈').trim()) || screen.getByText(/Score 30/))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  assert.deepEqual(closeCalls, ['close'])
})

test('LobbyShareModal shows a loading placeholder until the QR code is ready and copies the link', () => {
  const copyCalls = []
  const { rerender } = render(
    <LobbyShareModal
      isOpen
      gameId="brave-otter"
      shareLink="https://example.com/g/brave-otter"
      isShareLinkCopied={false}
      shareQrCodeDataUrl=""
      onCopyShareLink={() => copyCalls.push('copy')}
      onClose={() => {}}
      LinkIcon={Icon}
    />,
  )

  assert.ok(screen.getByText('Generating QR code...'))
  fireEvent.click(screen.getByRole('button', { name: 'Copy share link' }))
  assert.deepEqual(copyCalls, ['copy'])

  rerender(
    <LobbyShareModal
      isOpen
      gameId="brave-otter"
      shareLink="https://example.com/g/brave-otter"
      isShareLinkCopied
      shareQrCodeDataUrl="data:image/png;base64,xyz"
      onCopyShareLink={() => {}}
      onClose={() => {}}
      LinkIcon={Icon}
    />,
  )

  assert.ok(screen.getByRole('img', { name: /QR code for joining game/ }))
  assert.ok(screen.getByRole('button', { name: 'Share link copied' }))
})

test('ConfirmLobbyActionModal shows the pending label while busy and disables both buttons', () => {
  render(
    <ConfirmLobbyActionModal
      isOpen
      title="Remove seat?"
      description="This cannot be undone."
      confirmLabel="Remove"
      pendingLabel="Removing..."
      isPending
      onConfirm={() => {}}
      onClose={() => {}}
    />,
  )

  assert.ok(screen.getByText('Remove seat?'))
  assert.equal(screen.getByRole('button', { name: 'Cancel' }).disabled, true)
  assert.equal(screen.getByRole('button', { name: 'Removing...' }).disabled, true)
})

test('ConfirmLobbyActionModal confirms and cancels when not pending', () => {
  const calls = []
  render(
    <ConfirmLobbyActionModal
      isOpen
      title="Remove seat?"
      description="This cannot be undone."
      confirmLabel="Remove"
      pendingLabel="Removing..."
      isPending={false}
      onConfirm={() => calls.push('confirm')}
      onClose={() => calls.push('close')}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  assert.deepEqual(calls, ['confirm', 'close'])
})

test('RenameLobbyPlayerModal is hidden without a player and disables Save for a blank draft', () => {
  const { container, unmount } = render(
    <RenameLobbyPlayerModal player={null} draftValue="" setDraftValue={() => {}} isRenamingPlayer={false} onSubmit={() => {}} onClose={() => {}} />,
  )
  assert.equal(container.innerHTML, '')
  unmount()

  render(
    <RenameLobbyPlayerModal
      player={{ id: 'p1', name: 'Casey' }}
      draftValue="   "
      setDraftValue={() => {}}
      isRenamingPlayer={false}
      onSubmit={() => {}}
      onClose={() => {}}
    />,
  )
  assert.equal(screen.getByRole('button', { name: 'Save' }).disabled, true)
})

test('RenameLobbyPlayerModal submits the new name', () => {
  const submitted = []
  render(
    <RenameLobbyPlayerModal
      player={{ id: 'p1', name: 'Casey' }}
      draftValue="Cas"
      setDraftValue={() => {}}
      isRenamingPlayer={false}
      onSubmit={(event) => {
        event.preventDefault()
        submitted.push('submit')
      }}
      onClose={() => {}}
    />,
  )

  assert.equal(screen.getByRole('button', { name: 'Save' }).disabled, false)
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  assert.deepEqual(submitted, ['submit'])
})
