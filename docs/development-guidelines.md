# Development Guidelines

Core rules for working in this repo, derived from the Phase 0–6 quality audit
(`tmp/quality-audit-testing-plan.md`, `tmp/quality-audit-testing-checklist.md`,
`tmp/quality-audit-findings.md`). These are the load-bearing conventions the audit
established or surfaced as gaps — follow them by default; deviate only with a reason.

## 1. Project shape

- `backend/engine` — pure game-logic reducer (`backend/engine/reducer/*.ts`, one file per
  action) plus shared helpers under `backend/engine/helpers/reducer/{gameState,player,storage,
  validation}`. Keep this layer free of AWS SDK calls where possible except in `storage/`.
- `backend/src` — Lambda entrypoints (`handler.ts`, `websocket.ts`) and
  `validation/lambdaPayload.ts`. This is the only layer that talks to API Gateway.
- `shared/types` — types shared by frontend and backend (`@shared/*` path alias in
  `backend/tsconfig.json`). Payload shapes for every action live in `shared/types/lambda.ts`.
- `src/hooks` — frontend state machine, deliberately kept as `.js` (see
  `docs/decisions/frontend-hooks-ts-migration.md`) since ESLint + `tsc --noEmit` on the backend
  already cover the immediate type-safety gap. Don't convert a hook to `.ts`/`.tsx` in passing;
  that's a deliberate, tracked migration.
- `infrastructure/*.tf` — Terraform (OpenTofu) for all AWS resources. Two workspaces:
  `staging` and `prod` (`npm run deploy:staging` / `deploy:prod`).

## 2. Adding or changing a reducer action

Every reducer action in `backend/engine/reducer/` follows the same shape. When adding one:

1. Define the payload type in `shared/types/lambda.ts`.
2. Add a payload assertion in `backend/src/validation/lambdaPayload.ts`
   (`assert<Action>Payload`) and register it in the validator map. Non-empty-string checks
   alone are not enough — also bound string length for anything persisted to DynamoDB
   (see finding #10; no field should be allowed to grow unbounded).
3. **Decide the action's authorization requirement explicitly, and don't skip it.** The audit's
   critical finding (#2) was privileged actions (`addSeat`, `removeSeat`, `startGame`,
   `removePlayer`) shipping with no token check at all, because two parallel auth mechanisms
   exist:
   - `requireOwnerToken` / `requirePlayerToken` (`backend/engine/helpers/reducer/validation/`)
     — used by `renamePlayer.ts`, `removeGame.ts`.
   - `requireGameForAction` / `requirePlayerActionContext` — game-ID-only matching.

   Any action that mutates game membership, seats, or game lifecycle must call
   `requireOwnerToken` or `requirePlayerToken`, not just resolve the game by ID. When in doubt,
   require a token — a game-ID-only check is only correct for read-only or already-scoped
   actions.
4. Register the executor in `handler.ts`'s `ACTION_EXECUTORS` map and add it to
   `ACTION_PAYLOAD_VALIDATORS`. These two maps (plus the `validateLambdaPayload` switch) are
   independently maintained — adding an action to only one is a silent bug (finding #20). Add
   a test that exercises the action through the full handler contract
   (`backend/test/engineReducer.test.js` / `fullGameFlow.test.js` pattern), not just the
   reducer in isolation.
5. Write the test file as `backend/test/<actionName>.test.js` covering happy path + edge cases
   (wrong turn, stale/missing token, malformed payload) — this is the standing pattern for
   every file under `backend/engine` and `backend/src` (Phase 2 checklist). A new reducer file
   with no matching test file is a gap, not an exception.

## 3. Game-state writes and optimistic concurrency

`withNextVersion.ts` computes `version + 1` in memory but does **not** by itself make a write
safe — `putGame.ts` must issue the DynamoDB write with a `ConditionExpression` against the
expected version (finding #1: two concurrent Lambda invocations can otherwise both read
version N and both succeed, silently discarding one action). When touching `putGame.ts`,
`getGameVersionById.ts`, or any reducer that writes game state:

- Never assume `withNextVersion`'s output is safe to write unconditionally — the naming implies
  a guarantee it doesn't provide unless the write is conditioned on the read version.
- Add/extend a concurrent-write test (two "simultaneous" actions against the same game version)
  rather than trusting single-writer test coverage.

## 4. Error handling

**Backend (`handler.ts`, `websocket.ts`):**
- Any code that can throw before a response is sent must be inside the request's try/catch —
  don't add parsing or setup logic ahead of it (finding #5: `JSON.parse(event.body)` was
  running unguarded before the try block).
- Once a success response (`ok: true`) has been sent for a `requestId`, do not let subsequent
  code (e.g. `afterResponse` / AI-turn driving) throw into the same outer catch and send a
  second `ok: false` for that same `requestId` — that corrupts client-side request bookkeeping
  (finding #6). Post-response side effects get their own try/catch that logs and swallows.
- Don't return raw `error.message` to the client for unexpected/internal errors (DynamoDB
  exceptions, etc.) — only expected domain errors (thrown deliberately by validation/reducer
  code with a client-safe message) should be surfaced verbatim (finding #9). There's no
  `ValidationError`-vs-internal-error split in this codebase yet; if you're adding one, prefer
  a single narrow marker (e.g. a distinguishable error class or `isDomainError` check) over
  string-matching messages.
- No bare `catch {}` — always at least `console.error` on unexpected failures in cleanup paths
  (finding #18).

**Frontend (`src/hooks/*.js`):**
- Every action handler in `useActiveGameController.js` (and similar controller hooks) follows:
  `setGameError('')` → `try { await action() } catch (error) { if (isConcurrentUpdateError
  (error)) { ...refresh/resync... } setGameError(toGenericErrorMessage(error, '<user-facing
  message>')) }`. A handler with only a `finally` and no `catch` (finding #13) leaves the UI in
  a stuck state on failure with no error shown — every new handler must have the full
  try/catch/setGameError shape, matched to its sibling handlers.

## 5. Auth and secrets

- Tokens (`ownerToken`, `playerToken`) are random UUIDs compared over TLS. Comparisons in
  `requireOwnerToken.ts` / `requirePlayerToken.ts` currently use plain `===`/`!==`
  (finding #8, accepted as low-severity) — don't regress further by adding new token
  comparisons elsewhere without at least matching this pattern; a constant-time compare is
  preferred for any *new* secret-comparison code.
- The WebSocket API has no connection-level authorizer (finding #4) — all real
  authorization is action-level, via the token checks in §2. Never rely on API Gateway/Cognito
  having already authenticated the caller by the time a reducer action runs.
- Don't add a new AWS credential/identity path (Cognito identity pool, SigV4-signed Function
  URL calls, etc.) without wiring it into an actual request path — the existing
  IAM-authenticated Lambda Function URL is unused dead code today (finding #7); don't add a
  second one.
- `generateGameId.ts` uses `Math.random()` over a small (~8,900) combination space
  (finding #3) — treat game IDs as guessable, not as a secret, when reasoning about what they
  protect.

## 6. Testing

- **Backend**: `node --test` (native test runner), one test file per source file under
  `backend/engine` and `backend/src`, named `backend/test/<sourceFileName>.test.js`. Run via
  `npm run test:backend` (builds first) or `npm run test:backend:coverage`.
- **Frontend unit/component**: `node --import tsx/esm --test test/**/*.test.js
  test/**/*.test.jsx`, using `node:test` + `@testing-library/react` +
  `test/setupDom.js` (jsdom). Mock module boundaries with `mock.module(...)` (see
  `useSessionActions.test.js`) rather than reaching into implementation internals.
- **Integration**: `backend/test/fullGameFlow.test.js` / `engineReducer.test.js` drive the
  engine through the full handler contract (create → join → deal → bid → play → score →
  complete) rather than calling reducers directly — prefer extending these over adding a new
  isolated reducer-only test when the goal is to catch handler/reducer-boundary bugs.
- **E2E**: Playwright, `e2e/*.spec.js`, run via `npm run test:e2e` (builds backend first).
  New multiplayer or timing-sensitive behavior (reconnect, seat changes, AI turns) belongs in a
  new `e2e/<feature>.spec.js` using two browser contexts, following `away-reconnect.spec.js` /
  `seat-management.spec.js`.
- A source file with no corresponding test file is a gap the audit explicitly tracked
  (Phase 2 checklist: "confirm every file under `backend/engine`/`backend/src` has a
  corresponding test file") — keep that invariant when adding new files.
- Bug fixes found via review or production should be test-first: add the failing test, then
  fix (this is how Phase 3's finding-driven fixes, e.g. #13, were done).

## 7. Lint, format, types

- `npm run lint` (ESLint, flat config in `eslint.config.js`) and `npm run format` (Prettier: no
  semicolons, single quotes, 100-char width) must pass. `npm run lint:fix` /
  `npm run format:fix` before committing.
- `npm run typecheck` runs `tsc --noEmit` for `backend/` only (`strict: true`). Frontend `.js`
  files are linted but not type-checked — don't rely on TypeScript to catch frontend bugs;
  write the test instead.
- CI (`.github/workflows/ci.yml`) runs, in order: lint → typecheck → frontend tests → backend
  tests → build → Playwright E2E, on every PR and on `master`. A change that doesn't pass all
  of these locally isn't ready to push.

## 8. Infrastructure changes

- Any `infrastructure/*.tf` change must be validated with `tofu -chdir=./infrastructure plan`
  against the **staging** workspace before being trusted, and should leave `plan` clean
  ("No changes...") afterward — drift that "always shows a diff" is a bug to fix (e.g. a
  principal ARN format mismatch, a stale log-group reference), not something to work around by
  re-applying (finding #25).
- Prefer literal/normalized values that match what AWS reads back (e.g. a full
  `arn:aws:iam::<id>:root` rather than a bare account ID) over values that are semantically
  equivalent but string-different from what the provider will report on the next `plan`.
- Don't disable public-access-block / bucket-policy protections, or point CloudFront at a public
  S3 website endpoint instead of an OAC-fronted origin, without a specific reason — the current
  setup (finding #12) is accepted as low-risk only because the bucket holds public static
  assets; that reasoning doesn't extend to any bucket holding non-public data.
- `deletion_protection_enabled` and similar safety flags should be double-checked per workspace
  (`staging` vs `prod`) rather than assumed to carry the same value (finding #24) — prod and
  staging are expected to diverge here.

## 9. Known accepted gaps (don't re-flag, do keep in mind)

These are documented, intentional, or lower-priority items from the audit — not things to
"fix" opportunistically as a side effect of unrelated work, but real debt to account for when
touching related code:

- `useAppRuntime.js` is a large multi-effect hook (session restore, rejoin list, QR, AI-pause
  timing, away-modal, round-summary hydration). When adding a new effect here, be deliberate
  about its dependency array — effects keyed on whole session objects instead of the specific
  fields they use cause redundant teardown/reschedule (finding #22).
- `getActiveSessionContext({ ownerSession, playerSession })` boilerplate is repeated across
  `useActiveGameController`, `useSessionActions`, `useLobbyController`. A shared
  `useActiveSession()` hook is a reasonable extraction if you're touching more than one of
  these files for a related change — not a prerequisite for unrelated changes.
- Duplicate suit-normalization logic exists in `playCard.ts` (`getNormalizedSuit`) and
  `rainbow.ts` (`normalizeRainbowSuit`). If you're modifying trump/rainbow-suit handling in
  either, check whether the other needs the same change; consolidating them is worthwhile but
  out of scope for unrelated fixes.
- Phase 7 (prod verification gate, rollback documentation, prod CI gate) and Phase 8 (coverage
  thresholds enforced in CI, synthetic prod monitoring) are not yet done — don't assume a
  passing `staging` deploy implies a safe `prod` deploy path exists yet.
