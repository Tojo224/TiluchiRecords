# Feature: web-adjustments

Branch: `refactor/web-adjustments` (from `Brandon-Vasquez`)
Scope: `web/` only. The `ai/` and `backend/` folders are out of scope.

## Objective
Reduce duplication and fragility in the web client without changing user-visible behavior.

## Constraints
- Commits: Conventional Commits, NO co-author or AI attribution lines (user instruction).
- Each task is one work-unit commit and must compile on its own.
- Planning heuristic: about 400 authored changed lines per task (advisory only).
- No behavior changes. Refactors only.

## Resolved mode
- TDD: not enabled (no project/session configuration, no explicit user choice). Ordinary functional checks apply.
- Runner: Vitest is introduced in T1 (user approved).
- Baseline checks: `npm run build` (tsc strict + vite build) and `npm run format:check`, run from `web/`.

## Verified facts (before planning)
- `formatDuration` is duplicated in FaceSwapPage, MediaPlayer, KaraokePage.
- `setInterval` polling exists in ProjectContext, FaceSwapPage, MusicVideoPage.
- MusicVideoPage has ~58 `Running/Failed` flag references; FaceSwapPage ~14.
- No Vitest, no ESLint, no path aliases.

## Tasks
- [ ] T1 Add Vitest + Testing Library setup and a smoke test (`test:unit` script)
- [ ] T2 Move `formatDuration` to `shared/lib/format.ts`, replace 3 copies, add unit test
- [ ] T3 Tooling: path aliases (tsconfig + vite) and basic ESLint
- [ ] T4 ProjectContext: `useCallback` on exposed functions, `unknown` instead of `any` in catch blocks
- [ ] T5 `useJobPolling`: one polling hook replacing the 3 page/context intervals, with unit tests
- [ ] T6 `useJobForType`: returns `{ job, running, failed, completed }`, removes repeated flags, with unit tests
- [ ] T7 Split MusicVideoPage then FaceSwapPage into `components/` subcomponents

## Out of scope
- Moving the music-video pipeline orchestration to the backend.
- Token storage change (localStorage to httpOnly cookie).
- Route lazy loading (optional, last).

## Route declaration
Each task: delegated direct (one bounded writer, sequential). Trigger: writer trigger (2+ non-trivial files).

## Progress
Created. No tasks started.

## Evidence (commit per task)
(none yet)

## Next step
T1.
