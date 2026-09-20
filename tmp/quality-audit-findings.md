# Setback — Phase 1 Static Audit Findings

Derived from a full read-through of the backend engine, Lambda entrypoints, frontend
state-management hooks, and Terraform infrastructure. Findings are prioritized by severity.
Note: `backend/test/*.test.js` (via `node --test`) covers most reducer/helper logic already —
findings below call out where that coverage does *not* reach (concurrency, `handler.ts`,
`websocket.ts`).

## Critical

1. **No real optimistic-concurrency control on game writes.**
   `backend/engine/helpers/reducer/gameState/withNextVersion.ts` computes `version + 1` in
   memory, but `putGame.ts`'s `TransactWriteItems` issues a plain `Put` with no
   `ConditionExpression` (e.g. `version = :expected`). `getGameVersionById.ts` is never read
   back and checked before a write. Two concurrent Lambda invocations acting on the same game
   (e.g. two players' `playCard`, or a human move racing an AI auto-play) can both read version
   N, compute independent updates to N+1, and both succeed — last writer wins, silently
   discarding one action and desyncing all connected clients' view of hands/tricks/turn order.
   No test covers concurrent-write scenarios.

2. **Privileged reducer actions accept no auth token at all.**
   `addSeat.ts`, `removeSeat.ts`, `startGame.ts`, and `removePlayer.ts` — their payload types
   (`shared/types/lambda.ts:41-53, 89-92`) don't carry a `playerToken` field, and the reducers
   only call `requireGame`/`requireGameForAction` (game-ID match), never
   `requireOwnerToken`/`requirePlayerToken`. Contrast with `renamePlayer.ts` and
   `removeGame.ts`, which do call `requireOwnerToken`. Anyone who knows a `gameId` can add/remove
   AI seats, kick/replace any human player with a bot, or force-start the game with
   attacker-chosen `maxCards`/dealer — no token needed.

3. **Game IDs are low-entropy and brute-forceable, compounding #2.**
   `backend/engine/helpers/generateGameId.ts` builds `adjective-animal` IDs from lists totaling
   ~8,900 combinations, using `Math.random()` (not a CSPRNG). Combined with finding #2, an
   attacker can brute-force active game IDs in a loop and hijack/grief any live game without a
   token.

## High

4. **WebSocket API Gateway has no authorizer** (`infrastructure/main.tf:258-285`).
   `$connect`/`$disconnect`/`$default` routes default to `authorization_type = NONE`. This is
   the actual transport the frontend uses (`src/api/lambdaClient.js`). Anyone on the internet
   can open WebSocket connections and invoke any backend route directly; only a shared
   stage-level throttle (50 burst/100 rps) limits abuse — no per-identity auth, no Cognito
   check on this path.

5. **`backend/src/handler.ts:191` — unguarded `JSON.parse(event.body)`.**
   Runs before the try/catch that starts on line 196, and the exported `handler` itself has no
   top-level try/catch. A client sending malformed JSON throws uncaught; no error response is
   ever sent back, so the client hangs and the Lambda invocation fails silently.

6. **`backend/src/handler.ts:216` — `afterResponse` (AI turn driver) can cause a duplicate
   response with the same `requestId`.**
   `await result.afterResponse?.()` sits outside the inner try/catch but inside the outer one.
   If it throws (e.g. transient DynamoDB error while running AI turns), the outer `catch` sends
   a second `{ requestId, ok: false }` after the client already got `ok: true` for that same
   request — corrupting client-side request bookkeeping and risking duplicate resubmission of
   the original action against stale state.

7. **Cognito/SigV4 IAM-authenticated Lambda Function URL path is unused/dead.**
   `aws_lambda_function_url.backend` is correctly `AWS_IAM`, and the `frontend_unauth` IAM role
   is tightly scoped — but no frontend code references the Function URL, SigV4 signing, or the
   Cognito identity credential packages (installed in `package.json`, not imported anywhere in
   `src/`). The one properly-locked-down entry point isn't actually gating any real traffic;
   real traffic goes over the unauthenticated WebSocket API (finding #4).

## Medium

8. **Token comparisons are not timing-safe.**
   `requireOwnerToken.ts` and `requirePlayerToken.ts` compare tokens with plain `!==`/`===`
   rather than a constant-time compare. Lower severity since tokens are random UUIDs over TLS,
   but still a textbook timing side-channel.

9. **Raw error messages leaked to clients on unexpected exceptions.**
   `backend/src/handler.ts:217-224` returns `error.message` verbatim for *any* thrown error,
   including raw AWS SDK/DynamoDB exceptions (e.g. item-size-exceeded, conditional-check
   failures), leaking internal schema/storage details. No distinction between expected domain
   errors (fine to surface) and unexpected internal errors (should be generic).

10. **No upper bound on user-supplied string lengths.**
    `backend/src/validation/lambdaPayload.ts` (`requireNonEmptyString` and friends) only checks
    non-empty, not max length, for `gameId`, `playerName`, `playerId`, `playerToken`,
    `requestId`, and reaction fields. Unbounded strings get persisted into DynamoDB game/
    connection items, risking oversized items and cheap resource-exhaustion abuse.

11. **`handleDisconnect` blocks on a mandatory 5s `setTimeout`** (`handler.ts:455-466`) with no
    idempotency guard against API Gateway retrying the `$disconnect` invocation — could
    double-run presence updates.

12. **CloudFront origin is a public S3 *website* endpoint over `http-only`, not an OAC-fronted
    REST origin** (`infrastructure/main.tf:460-523, 533-552`). Public-access-block protections
    are disabled and the bucket policy allows public `s3:GetObject`. Viewers can bypass
    CloudFront entirely and hit the S3 website endpoint directly over unencrypted HTTP,
    skipping CloudFront-level protections. Content is public static assets, so confidentiality
    impact is low, but it undermines the CloudFront-fronting intent (no OAC/geo-restriction/WAF
    enforcement possible).

13. **`handleContinueGame` has no error handling** (`src/hooks/useActiveGameController.js:304-324`).
    Every sibling action handler (`handleDealCards`, `handleSubmitBid`, `handlePlayCard`, etc.)
    wraps its call in try/catch, checks `isConcurrentUpdateError`, and calls `setGameError`.
    `handleContinueGame` only has a `finally`. If `returnFromAway` throws, the away-modal stays
    open, no error is shown, and state is never resynced — the "Continue" button appears
    permanently broken to the user.

14. **Duplicate/overlapping effects both drive `displayedTurnPlayerId`**
    (`src/hooks/useGameTablePlayState.js:90-101`). Two effects race to set the displayed turn
    player around trick completion; today masked by an additional gate elsewhere, but fragile —
    a future consumer of `displayedTurnPlayerId` that doesn't also check
    `isTrickWinnerRevealVisible` will see the turn indicator jump before the "won the book"
    reveal.

## Low / Info

15. `dealCards.ts` re-draws when the revealed trump card is a Joker — presumably intentional,
    but the reshuffle/skip semantics aren't documented or tested against tabletop Setback rules.
16. `rainbow.ts`'s `hasRainbow` would misbehave if `trumpSuit === "Joker"`; likely unreachable
    given `dealCards.ts` always re-draws non-Jokers, but worth a defensive comment.
17. `scoreRound.ts` `possibleMultiplier` (display-only stat) diverges from the real scoring rule
    in `scoreForPlayer` — cosmetic today, wrong if ever surfaced as "max achievable this round."
18. `websocket.ts:74-76` — bare `catch {}` on connection cleanup silently swallows all errors,
    including real DynamoDB failures, with no logging.
19. `lambdaPayload.ts` — `assertRenamePlayerPayload` never validates optional `payload.playerId`,
    unlike other optional fields in the same file.
20. `handler.ts:263-266` — `parseLambdaEvent` force-casts `action` with no allow-list check;
    correctness depends on three independently-maintained structures
    (`ACTION_PAYLOAD_VALIDATORS`, `ACTION_EXECUTORS`, and the `validateLambdaPayload` switch)
    staying in sync.
21. `websocket.ts`/broadcast paths echo user-controlled strings (names, reaction phrases) into
    JSON with no output encoding — safe only if the frontend always renders as text; confirm no
    HTML-rendering path exists (stored-XSS risk otherwise).
22. `requestActiveStateReview` scheduling effects in `useAppRuntime.js:602-659` depend on whole
    session objects (new reference on every sync) instead of the specific fields used, causing
    redundant effect teardown/reschedule during `Scoring`/`EndOfRound`.
23. Reaction-cooldown timer (`useActiveGameController.js:356-362`) isn't reset per session — a
    pending cooldown can carry over into a newly joined game (minor UX only).
24. `main.tf:109` — `deletion_protection_enabled = false` on the game-state DynamoDB table;
    confirm intentional for the prod workspace, not just staging.

## Tech debt / code smells

- `withNextVersion` naming implies safety it doesn't provide (see finding #1) — either wire it
  to a real conditional write or rename it.
- Two parallel authorization mechanisms exist (`requireOwnerToken`/`requirePlayerToken` vs.
  `requireGameForAction`/`requirePlayerActionContext`), making it easy to add a new reducer
  action and forget authorization (see finding #2). Consider a single context builder that
  mandates a token type per action at the type level.
- No centralized error classification (domain `ValidationError` vs. infrastructure error)
  before `handler.ts`'s client-facing catch block (see finding #9).
- Duplicate trump/rainbow-suit normalization logic (`getNormalizedSuit` in `playCard.ts` vs.
  `normalizeRainbowSuit` in `rainbow.ts`) — same semantics, two implementations.
- `advancePhase.ts`'s dealer-tie-break rule for bidding is undocumented and untested.
- `handler.ts` and `websocket.ts` have zero test coverage despite being the actual Lambda entry
  points — highest-value gap for Phase 2.
- `useAppRuntime.js` is a ~700-line effect grab-bag (session restore, rejoin-list, QR code, AI
  pause timing, away-modal, round-summary hydration) — hard to reason about effect ordering.
- Repeated `getActiveSessionContext({ ownerSession, playerSession })` boilerplate across
  `useActiveGameController`, `useSessionActions`, `useLobbyController` — candidate for a shared
  `useActiveSession()` hook.
- `ACTION_EXECUTORS`/`ACTION_PAYLOAD_VALIDATORS` in `handler.ts` are independently maintained
  parallel maps — table-driven consolidation would remove a class of drift bugs.

## Priority feed into Phase 3 (test-first bug fixes)

Highest priority to fix, test-first, before/during Phase 3:
1. Findings #1–#3 (concurrency + missing auth on privileged actions + weak game IDs) — these
   compound into a real live-griefing vector.
2. Findings #4, #7 (WebSocket API has no authorizer; the IAM-authenticated path is dead code) —
   architectural, needs a decision on whether to wire Cognito auth onto the WebSocket path or
   accept it as intentionally open and rely on token-based authorization instead.
3. Findings #5, #6, #9 (handler.ts error/response handling) — straightforward, contained fixes.
4. Finding #13 (`handleContinueGame` missing error handling) — straightforward, contained fix.
