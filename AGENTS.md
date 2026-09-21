# AGENTS.md

Instructions for AI coding agents working in this repo.

## Keep yourself in line with the current shape of the project

This repo evolves (structure, tooling, conventions, accepted debt). Before making changes:

- Read `docs/development-guidelines.md` first — it's the current source of truth for how this
  codebase is structured and how to extend it (reducer-action shape, auth requirements, error
  handling patterns, testing layers, infra discipline). It is derived from a real audit of this
  codebase, not generic advice — treat it as binding unless the code you're looking at has since
  diverged from it.
- If you find the guidelines doc is out of date with what the code actually does (a pattern has
  changed, a "known accepted gap" has been fixed, a new layer/directory has appeared), update
  `docs/development-guidelines.md` as part of your change rather than silently working around
  the mismatch or leaving it stale for the next agent.
- Match existing conventions in the file/directory you're editing over anything generic you'd
  otherwise default to (e.g. `src/hooks/*.js` stays `.js`, not `.ts` — see
  `docs/decisions/frontend-hooks-ts-migration.md`). Don't introduce a new pattern, dependency,
  or abstraction when an established one in this repo already covers the case.
- Don't invent project structure. If a task seems to require a new top-level directory, a new
  parallel auth/validation mechanism, or a new testing approach, that's a signal to check
  `docs/` and existing code more carefully first — the audit specifically flagged "two parallel
  mechanisms that do the same thing" as a recurring source of bugs in this repo.

## Commit rules

- Do not add any AI/agent authorship or signature lines to commit messages or PR
  descriptions — no `Co-Authored-By` for an AI/agent, no "Generated with"/"Created by" tool
  attribution, no session links or agent identifiers of any kind. Commits should read as if
  written by the human directing the work.
- Write commit messages in the imperative mood, focused on *why*, matching the existing log
  style (see `git log`) — e.g. "Fix staging terraform drift, complete Phase 6 checklist".
- Only create commits when explicitly asked to. Don't commit as a side effect of finishing a
  task unless the user requested it.
- Never use `git commit --amend`, force-push, or other history-rewriting commands unless
  explicitly requested — always create a new commit.
- Never skip hooks (`--no-verify`) or bypass signing.
- Stage specific files by name; don't use `git add -A`/`git add .` blindly — review what's
  staged before committing, especially for anything that could contain secrets or credentials.
- Run lint, typecheck, and the relevant test suite (see `docs/development-guidelines.md` §7)
  before committing — don't rely on CI to catch what can be checked locally first.
