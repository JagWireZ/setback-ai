# Setback — Quality Audit & Testing Plan

Project scan summary: Setback is a real-time multiplayer card game — React 18 + Vite PWA
frontend, TypeScript Lambda-based WebSocket game engine backend (DynamoDB), deployed to AWS
via Terraform with Cognito guest auth, staging/prod workspaces.

## Current state

- **Backend** (`backend/engine/**`): ~2,800 lines, decent unit test coverage already (20 test
  files covering reducers, helpers, AI turns) using `node --test`.
- **Frontend** (`src/**`): ~8,000 lines across hooks/components/utils, only **2 test files**
  exist (`sessionState`, `useAppState`). Hooks like `useActiveGameController`,
  `useGameTablePlayState`, `useLobbyController` — the core game-flow logic — are untested.
- **No CI** (`.github/` is empty) — nothing runs tests, lint, or type-checks on push/PR.
- **No ESLint/Prettier config** anywhere in the repo.
- **No integration/e2e tests** — nothing exercises the actual WebSocket protocol between
  frontend and backend, or a real game session end-to-end.
- **Infrastructure** (Terraform) has no validation (`plan`/`fmt`/`validate`) wired into
  anything, and no automated tests for staging vs. prod parity.
- Backend `tsc` build is the only type-check; frontend has no `tsc --noEmit` step despite
  being JS (so no type safety at all on frontend).

## Phase 0 — Tooling foundation (prerequisite, ~0.5–1 day)

Nothing downstream is trustworthy without this in place first.

- Add ESLint + Prettier configs for both frontend (JS/JSX) and backend (TS); wire `lint`
  scripts into `package.json`.
- Add `tsc --noEmit` checks; consider whether frontend should migrate critical hooks to
  `.ts`/`.tsx` (flag as decision point, not required for this audit).
- Stand up GitHub Actions CI: lint → type-check → unit tests → build, on every PR and on
  `master`.
- Establish a coverage tool (`c8`/`node --test --experimental-test-coverage`) with a baseline
  report so later phases have a number to move.

## Phase 1 — Static audit (quality pass, no new code)

- Full read-through of backend reducer/engine logic for correctness bugs, race conditions in
  concurrent game-state writes (DynamoDB optimistic versioning via `withNextVersion.ts`), and
  edge cases in scoring (`scoreRound.ts`, `rainbow.ts`).
- Review frontend hooks for state-management bugs, especially the recently-refactored
  `useAppState`/`useActiveGameController`/reducer slices (git history shows active refactor
  work here — highest risk of regressions).
- Review `backend/src/handler.ts` and `websocket.ts` for input validation gaps, auth/token
  handling (`requireOwnerToken`, `requirePlayerToken`), and error handling that could leak
  internals or crash the Lambda.
- Security pass: Cognito identity pool permissions, IAM policy scope in
  `infrastructure/*.tf`, S3/CloudFront bucket policies, and whether the Lambda Function URL is
  properly IAM-authenticated end-to-end.
- Output: a findings doc (bugs, risks, tech debt) prioritized by severity — this feeds
  Phase 3.

## Phase 2 — Backend test suite completion

- Fill gaps in reducer coverage: confirm every action in `backend/engine/reducer/*.ts`
  (addSeat, movePlayer, joinGame, submitBid, playCard, etc.) has tests for both happy path and
  invalid/edge inputs (wrong turn, stale token, malformed payload).
- Add tests for `backend/src/handler.ts` and `websocket.ts` — currently untested despite being
  the actual entry point (route handling, connection lifecycle, error responses).
- Add tests for `backend/src/validation/lambdaPayload.ts` schema validation.
- Target: every file under `backend/engine` and `backend/src` has a corresponding test file.

## Phase 3 — Frontend test suite build-out

- Unit-test the untested hooks: `useActiveGameController`, `useGameTablePlayState`,
  `useGameTableState`, `useGameTableModalState`, `useLobbyController`,
  `useLobbyDerivedState`, `useSessionActions`, `useAppModalState`, `useAppRuntime`.
- Unit-test pure utils: `gameSessions.js`, `gameUi.js`, `playerPresence.js`,
  `reactionPhrases.js`, `frontendErrors.js`.
- Add component tests (React Testing Library) for key screens: `GameTablePage`,
  `AppModals`, `AppScreens`, `Scoreboard`, `Cards` — focus on user-visible behavior (bidding,
  playing a card, reactions) not implementation detail.
- Fix any bugs surfaced from Phase 1 findings as tests are written (test-first for known
  issues).

## Phase 4 — Integration tests (the biggest gap)

- Spin up the backend reducer/engine in-process (not deployed) and drive a full game through
  the WebSocket handler contract — create game → join → deal → bid → play tricks → score →
  complete — verifying game-state transitions end-to-end, not just isolated reducer calls.
- Add a frontend integration layer test that mocks the WebSocket boundary
  (`lambdaClient.js`) and verifies a full session flow through the React hooks/UI together.
- If feasible, a thin real end-to-end test: deploy-independent local harness that runs actual
  Lambda handler code + a local DynamoDB (e.g. `dynamodb-local`) to catch serialization/schema
  issues static tests miss.

## Phase 5 — E2E / browser tests

- Introduce Playwright (or similar) for true browser E2E: load the app, create a game, join
  as a second "player" (second browser context), play a full hand — this is the only way to
  catch PWA/service-worker, routing, and real rendering bugs.
- Cover install-prompt/offline behavior from `src/utils/pwa.js` if that's in scope for
  "quality."

## Phase 6 — Dev/staging verification pass

- Deploy to staging via existing `deploy:staging` script.
- Run the E2E suite against staging (real Lambda, real DynamoDB, real Cognito) — not mocks —
  to validate the actual deployed contract, not just code correctness.
- Manual/scripted smoke test checklist: multi-player session over real WebSocket, AI player
  turns (`runAiTurnsForGame.ts`), reconnect/away-player handling (`coverAwayPlayerTurn`,
  `returnFromAway`), seat management edge cases.
- Verify Terraform plan is clean (`terraform plan` shows no drift) for staging.

## Phase 7 — Production verification & gate

- `terraform plan` against prod workspace reviewed for drift/unexpected changes before any
  apply.
- Canary/smoke test in prod immediately post-deploy (lightweight version of Phase 6 checklist,
  safe to run against real infra — e.g. create-and-abandon-game rather than a full session
  with real users).
- Add CI gate: prod deploy only runs after full test suite (unit + integration +
  E2E-against-staging) passes.
- Document a rollback procedure (Terraform workspace + Lambda version) in case a bad deploy
  ships.

## Phase 8 — Ongoing guardrails

- Coverage thresholds enforced in CI (fail PR if coverage drops).
- Add a lightweight synthetic monitor/health-check hitting the prod Lambda Function URL on a
  schedule, so regressions between deploys surface without waiting for a user report.

## Sequencing note

Phases 0–3 are foundational and should happen in order. Phases 4–5 are the highest-effort,
highest-value work given the current near-zero integration/e2e coverage. Phase 6–7 can't
happen meaningfully until 4–5 exist, since "verified via dev and prod" implies you're running
the same suite against both environments, not just unit tests.
