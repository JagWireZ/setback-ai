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

- [ ] Review backend reducer/engine logic for correctness bugs
- [ ] Review DynamoDB optimistic versioning (`withNextVersion.ts`) for race conditions
- [ ] Review scoring edge cases (`scoreRound.ts`, `rainbow.ts`)
- [ ] Review frontend state-management hooks for bugs (`useAppState`, `useActiveGameController`, reducer slices)
- [ ] Review `backend/src/handler.ts` for input validation gaps
- [ ] Review `backend/src/websocket.ts` for input validation gaps
- [ ] Review auth/token handling (`requireOwnerToken`, `requirePlayerToken`)
- [ ] Review error handling for internal-detail leaks / crash risk
- [ ] Security review: Cognito identity pool permissions
- [ ] Security review: IAM policy scope in `infrastructure/*.tf`
- [ ] Security review: S3/CloudFront bucket policies
- [ ] Verify Lambda Function URL is properly IAM-authenticated end-to-end
- [ ] Write up findings doc (bugs, risks, tech debt) prioritized by severity

## Phase 2 — Backend test suite completion

- [ ] Test `addSeat.ts` (happy path + edge cases)
- [ ] Test `movePlayer.ts` (happy path + edge cases)
- [ ] Test `joinGame.ts` (happy path + edge cases)
- [ ] Test `submitBid.ts` (happy path + edge cases)
- [ ] Test `playCard.ts` (happy path + edge cases)
- [ ] Test remaining reducer actions for happy path + invalid/edge inputs (wrong turn, stale token, malformed payload)
- [ ] Add tests for `backend/src/handler.ts` (route handling, connection lifecycle, error responses)
- [ ] Add tests for `backend/src/websocket.ts`
- [ ] Add tests for `backend/src/validation/lambdaPayload.ts` schema validation
- [ ] Confirm every file under `backend/engine` has a corresponding test file
- [ ] Confirm every file under `backend/src` has a corresponding test file

## Phase 3 — Frontend test suite build-out

- [ ] Unit test `useActiveGameController`
- [ ] Unit test `useGameTablePlayState`
- [ ] Unit test `useGameTableState`
- [ ] Unit test `useGameTableModalState`
- [ ] Unit test `useLobbyController`
- [ ] Unit test `useLobbyDerivedState`
- [ ] Unit test `useSessionActions`
- [ ] Unit test `useAppModalState`
- [ ] Unit test `useAppRuntime`
- [ ] Unit test `gameSessions.js`
- [ ] Unit test `gameUi.js`
- [ ] Unit test `playerPresence.js`
- [ ] Unit test `reactionPhrases.js`
- [ ] Unit test `frontendErrors.js`
- [ ] Component test `GameTablePage`
- [ ] Component test `AppModals`
- [ ] Component test `AppScreens`
- [ ] Component test `Scoreboard`
- [ ] Component test `Cards`
- [ ] Fix bugs surfaced by Phase 1 findings, test-first

## Phase 4 — Integration tests

- [ ] Build in-process harness driving backend engine through full WebSocket handler contract
- [ ] Test full game flow: create → join → deal → bid → play tricks → score → complete
- [ ] Add frontend integration test mocking WebSocket boundary (`lambdaClient.js`)
- [ ] Verify full session flow through React hooks/UI together
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
