# Frontend State Migration

This file captures the remaining reducer migration stages after the first pass that introduced [`useAppState`](../src/hooks/useAppState.js).

## Current State

Completed in stage 1:

- Shared app/session/request/form state moved from scattered `useState` calls in `App.jsx` into [`src/hooks/useAppState.js`](../src/hooks/useAppState.js)
- Main controller hooks now consume grouped `appState` and `appActions`
- Modal-specific state and game-table interaction state remain local

This is intentional. The remaining work should keep the reducer focused on shared state, not move every local UI concern into the same store.

## Stage 2: Replace Generic Setters With Domain Actions

Goal:
- Make state transitions explicit and easier to reason about

Changes:
- Replace generic reducer writes like `setField('gameError')` with domain actions
- Introduce reducer actions for create/join/rejoin/session restore flows
- Move repetitive multi-field resets out of `App.jsx` handlers and into reducer cases

Suggested actions:
- `create_game_started`
- `create_game_failed`
- `create_game_succeeded`
- `join_game_started`
- `join_game_failed`
- `join_game_succeeded`
- `rejoin_game_started`
- `rejoin_game_failed`
- `rejoin_game_succeeded`
- `session_cleared`
- `home_request_cleared`
- `create_draft_reset`
- `join_draft_reset`
- `game_action_started`
- `game_action_finished`

Expected impact:
- Smaller handlers in [`src/App.jsx`](../src/App.jsx)
- Less repeated state reset logic across hooks
- Easier testing of state transitions

## Stage 3: Split Reducer State Into Named Slices

Goal:
- Improve readability of the reducer shape and make related updates easier to maintain

Suggested state shape:

```js
{
  home: {
    createForm: {},
    joinForm: {},
    requestError: '',
    sessionInfo: null,
    rejoinableGames: [],
  },
  session: {
    ownerSession: null,
    playerSession: null,
  },
  game: {
    gameError: '',
    lobbyInfo: '',
    sortMode: 'bySuit',
    persistedEndOfRoundSummary: null,
    pendingPlayerActionId: '',
    reactionCooldownUntil: 0,
  },
  requests: {
    isCreatingGame: false,
    isJoiningGame: false,
    isRejoiningGame: false,
    isLoadingRejoinGames: false,
    isStartingGame: false,
    isDealingCards: false,
    isSubmittingBid: false,
    isPlayingCard: false,
    isSendingReaction: false,
    isRenamingPlayer: false,
    isSortingCards: false,
    isContinuingGame: false,
    isLeavingGame: false,
    isStartingOver: false,
  },
}
```

Expected impact:
- Fewer unrelated fields at the top level
- Cleaner prop assembly in [`src/App.jsx`](../src/App.jsx)
- Better boundaries between home flow state and active game state

## Stage 4: Add Reducer-Focused Tests

Goal:
- Lock down state behavior before any larger cleanup

Add tests for:
- form reset behavior
- join/rejoin selection behavior
- request start/finish transitions
- session switch behavior between owner and player
- active session clearing
- persisted summary reset behavior

Suggested location:
- `test/useAppState.test.js`

Expected impact:
- Safer refactors in later stages
- Less reliance on manual UI verification for state transitions

## Stage 5: Simplify `App.jsx` Further

Goal:
- Turn `App.jsx` into composition, not orchestration

Changes:
- Extract prop-building logic into small selectors/helpers where it improves readability
- Reduce direct inline reset code in `App.jsx`
- Keep `App.jsx` focused on wiring routes, modal props, and feature hooks

Expected impact:
- `App.jsx` becomes easier to scan
- Reduced coupling between render code and state transition logic

## Stage 6: Review Modal State Separately

Goal:
- Only centralize modal state that is truly shared

Do not default to moving everything.

Review:
- [`src/hooks/useAppModalState.js`](../src/hooks/useAppModalState.js)

Possible follow-up:
- Consolidate only clearly related modal toggles or draft/reset flows
- Leave transient modal-local details on `useState`

Expected impact:
- Avoids over-centralizing UI details
- Preserves the current local-state strengths of the modal and game-table hooks

## Out Of Scope

These should stay local unless a concrete problem appears:

- [`src/hooks/useGameTablePlayState.js`](../src/hooks/useGameTablePlayState.js)
- [`src/hooks/useGameTableModalState.js`](../src/hooks/useGameTableModalState.js)
- DOM measurement state
- animation state
- temporary card selection state

## Recommended Order

1. Stage 2: domain actions
2. Stage 3: state slices
3. Stage 4: reducer tests
4. Stage 5: `App.jsx` cleanup
5. Stage 6: modal review
