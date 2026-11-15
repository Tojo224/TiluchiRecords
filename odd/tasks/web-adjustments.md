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
- [x] T1 Add Vitest + Testing Library setup and a smoke test (`test:unit` script)
- [x] T2 Move `formatDuration` to `shared/lib/format.ts`, replace 3 copies, add unit test
- [x] T3 Tooling: path aliases (tsconfig + vite) and basic ESLint
- [x] T4 ProjectContext: `useCallback` on exposed functions, `unknown` instead of `any` in catch blocks
- [x] T5 `useJobPolling`: one polling hook replacing the 3 page/context intervals, with unit tests
- [x] T6 `useJobForType`: returns `{ job, running, failed, completed }`, removes repeated flags, with unit tests
- [ ] T7 Split MusicVideoPage then FaceSwapPage into `components/` subcomponents

## Out of scope
- Moving the music-video pipeline orchestration to the backend.
- Token storage change (localStorage to httpOnly cookie).
- Route lazy loading (optional, last).

## Route declaration
Each task: delegated direct (one bounded writer, sequential). Trigger: writer trigger (2+ non-trivial files).

## Progress
T1-T6 done and verified (build, unit tests, lint; format:check clean for touched files). T7 partial: MusicVideoPage split; FaceSwapPage next.

## Evidence (commit per task)
- T1: e073694 chore(web): add vitest unit testing setup
- T2: ba0d156 refactor(web): share formatDuration helper (shared helper is m:ss; FaceSwap keeps its "Duracion por detectar" fallback and its h:mm:ss format for videos of one hour or more via a local wrapper, restored in a follow-up fix commit after review found a behavior change)
- T3: 8a9f07b chore(web): add path alias and eslint config (lint reports 8 pre-existing warnings, 0 errors)
- T4: 435480c refactor(web): stabilize ProjectContext callbacks and error typing (lint warnings 8 -> 6)
- T5: fd670db refactor(web): unify job polling in useJobPolling (single timer in ProjectContext via useJobPolling: 1s while a page retains fast polling, else 3s; pages call useActiveJobPolling)
- T6: 6ab4f19 refactor(web): add useJobForType and drop repeated job flags (pure selectJobForType/getJobFlags + thin useJobForType; all pages kept first-match-in-list-order semantics; MusicVideoPage uses the pure helpers inside its dependent useMemo chain; lint warnings stay 6; 25 unit tests)
- T7 (partial): 7db944d refactor(web): split MusicVideoPage into focused components (page 651 -> 388 lines; new components/PhaseTwoPanel, SceneList; lib/scene-labels, music-video-state with unit tests; 39 unit tests; lint warnings stay 6; exceeds the ~400-line heuristic naturally because it is a verbatim move; FaceSwapPage pending)
- Note: format:check fails on ~44 untouched files on Windows because of CRLF checkouts (autocrlf); pre-existing.

## Next step
T7: split FaceSwapPage (MusicVideoPage done).
