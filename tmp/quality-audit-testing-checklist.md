# Setback — Quality Audit & Testing Checklist

Derived from `quality-audit-testing-plan.md`. Check items off as completed.

## Phase 0 — Tooling foundation

- [x] Add ESLint config for frontend (JS/JSX)
- [x] Add ESLint config for backend (TS)
- [x] Add Prettier config (shared across frontend/backend)
- [x] Wire `lint` script(s) into root and backend `package.json`
- [x] Add `tsc --noEmit` check for backend
- [x] Decide whether frontend hooks should migrate to `.ts`/`.tsx` (decision point, not required)
- [x] Stand up GitHub Actions CI workflow: lint → type-check → unit tests → build
- [x] Run CI on every PR and on `master`
- [x] Add coverage tooling (`c8` or `node --test --experimental-test-coverage`)
- [x] Generate baseline coverage report (frontend + backend)

## Phase 1 — Static audit

- [x] Review backend reducer/engine logic for correctness bugs
- [x] Review DynamoDB optimistic versioning (`withNextVersion.ts`) for race conditions
- [x] Review scoring edge cases (`scoreRound.ts`, `rainbow.ts`)
- [x] Review frontend state-management hooks for bugs (`useAppState`, `useActiveGameController`, reducer slices)
- [x] Review `backend/src/handler.ts` for input validation gaps
- [x] Review `backend/src/websocket.ts` for input validation gaps
- [x] Review auth/token handling (`requireOwnerToken`, `requirePlayerToken`)
- [x] Review error handling for internal-detail leaks / crash risk
- [x] Security review: Cognito identity pool permissions
- [x] Security review: IAM policy scope in `infrastructure/*.tf`
- [x] Security review: S3/CloudFront bucket policies
- [x] Verify Lambda Function URL is properly IAM-authenticated end-to-end
- [x] Write up findings doc (bugs, risks, tech debt) prioritized by severity

## Phase 2 — Backend test suite completion

- [x] Test `addSeat.ts` (happy path + edge cases)
- [x] Test `movePlayer.ts` (happy path + edge cases)
- [x] Test `joinGame.ts` (happy path + edge cases)
- [x] Test `submitBid.ts` (happy path + edge cases)
- [x] Test `playCard.ts` (happy path + edge cases)
- [x] Test remaining reducer actions for happy path + invalid/edge inputs (wrong turn, stale token, malformed payload)
- [x] Add tests for `backend/src/handler.ts` (route handling, connection lifecycle, error responses)
- [x] Add tests for `backend/src/websocket.ts`
- [x] Add tests for `backend/src/validation/lambdaPayload.ts` schema validation
- [x] Confirm every file under `backend/engine` has a corresponding test file
- [x] Confirm every file under `backend/src` has a corresponding test file

## Phase 3 — Frontend test suite build-out

- [x] Unit test `useActiveGameController`
- [x] Unit test `useGameTablePlayState`
- [x] Unit test `useGameTableState`
- [x] Unit test `useGameTableModalState`
- [x] Unit test `useLobbyController`
- [x] Unit test `useLobbyDerivedState`
- [x] Unit test `useSessionActions`
- [x] Unit test `useAppModalState`
- [x] Unit test `useAppRuntime`
- [x] Unit test `gameSessions.js`
- [x] Unit test `gameUi.js`
- [x] Unit test `playerPresence.js`
- [x] Unit test `reactionPhrases.js`
- [x] Unit test `frontendErrors.js`
- [x] Component test `GameTablePage`
- [x] Component test `AppModals`
- [x] Component test `AppScreens`
- [x] Component test `Scoreboard`
- [x] Component test `Cards`
- [x] Fix bugs surfaced by Phase 1 findings, test-first (finding #13: `handleContinueGame` missing error handling — fixed; #14/#22/#23 are lower-severity/architectural and left for a follow-up pass)

## Phase 4 — Integration tests

- [x] Build in-process harness driving backend engine through full WebSocket handler contract
- [x] Test full game flow: create → join → deal → bid → play tricks → score → complete
- [x] Add frontend integration test mocking WebSocket boundary (`lambdaClient.js`)
- [x] Verify full session flow through React hooks/UI together
- [ ] (Stretch) Local harness running real Lambda handler code + `dynamodb-local` for serialization/schema issues

## Phase 5 — E2E / browser tests

- [ ] Introduce Playwright (or equivalent)
- [ ] E2E: create a game
- [ ] E2E: second player joins via second browser context
- [ ] E2E: play a full hand end-to-end
- [ ] E2E: PWA install-prompt / offline behavior (`src/utils/pwa.js`)

## Phase 6 — Dev/staging verification pass

- [ ] Deploy to staging via `deploy:staging`
- [ ] Run E2E suite against staging (real Lambda, DynamoDB, Cognito)
- [ ] Smoke test: multi-player session over real WebSocket
- [ ] Smoke test: AI player turns (`runAiTurnsForGame.ts`)
- [ ] Smoke test: reconnect/away-player handling (`coverAwayPlayerTurn`, `returnFromAway`)
- [ ] Smoke test: seat management edge cases
- [ ] Verify `terraform plan` shows no drift for staging

## Phase 7 — Production verification & gate

- [ ] Review `terraform plan` against prod workspace for drift/unexpected changes
- [ ] Run canary/smoke test in prod immediately post-deploy (safe, non-disruptive)
- [ ] Add CI gate: prod deploy only runs after full test suite passes (unit + integration + E2E-against-staging)
- [ ] Document rollback procedure (Terraform workspace + Lambda version)

## Phase 8 — Ongoing guardrails

- [ ] Enforce coverage thresholds in CI (fail PR on coverage drop)
- [ ] Add scheduled synthetic monitor/health-check against prod Lambda Function URL
