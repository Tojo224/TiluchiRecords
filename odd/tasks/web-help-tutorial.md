# Feature: web-help-tutorial

Branch: `feat/web-help-tutorial` (from `refactor/web-adjustments`)
Scope: `web/` only. `backend/` and `ai/` are out of scope.
Reference design: `web/tutorial-adaptativo.md` (Case2Code adaptive tour, adapted; NOT copied: no zustand here).

## Objective
Give end users an intuitive way to learn and use TiluchiRecords: (1) inline help that explains why an action is disabled, (2) an adaptive mission-based tour (driver.js) that observes what the user does, (3) a `/help` page with a manual per flow.

## Problem
- Face swap "Iniciar reemplazo", Karaoke "Crear karaoke" and Music video phase 2 are disabled without saying which requirement is missing.
- Users do not understand "project as container", Archivos vs Resultados, async jobs, or the 2-phase music video.
- No anchors (`data-tour`), no help page, no onboarding.

## Constraints
- Additive only: no behavior change in existing flows.
- Reuse existing UI (`Notice`, `Panel`, `Button`, `PageHeader`, `cn`) before creating components.
- Commits: Conventional Commits, NO co-author or AI attribution lines (user instruction).
- Each task = one work-unit commit that compiles alone, tests with code, about 400 authored changed lines (advisory).
- UI copy in Spanish following the project convention (no accents, e.g. "Todavia").
- E2E constraints (web/tests/e2e/navigation.spec.ts): exactly one `navigation` landmark; links "Mi perfil" and "Proyectos" (exact) must stay unique; nav must not contain "Seguridad". New nav links go INSIDE the existing `<nav>`.
- localStorage always in try/catch; key `tiluchi_tour_v1:${user.id}`.
- Do not highlight anything inside `KaraokeSingingModal`.

## Resolved mode
- TDD: not enabled (no config, no explicit user choice). Ordinary functional checks.
- Runner: Vitest (`npm run test:unit`). Checks from `web/`: `npm run build`, `npm run lint`, `npm run test:unit`. `format:check` fails on ~44 untouched files due to CRLF on Windows (pre-existing); only check touched files.
- Skills used: `work-unit-commits`.

## Key design decisions
- `TourProvider` in `AppLayout` (progress, UI); `TourProjectBridge` rendered inside `ProjectProviderLayout` pushes a primitives-only snapshot (useProject is not available in AppLayout).
- Snapshot = numbers/booleans compared with `sameInputs()` to survive 1-3 s polling.
- `tourSelector()` returns the first VISIBLE match (Sidebar is duplicated in DOM: desktop + mobile drawer). Steps anchor on page content, not the Sidebar (except the help link).
- Missions are pure `detect(snapshot)` functions, unit tested.

## Delivery forecast
~900-1200 authored changed lines across 4-5 tasks. Each task commit is an independent slice candidate.
Chain strategy (user decision): PRs target `refactor/web-adjustments` (the latest pushed branch, base of this work), not `main`. The assistant does NOT open PRs: it keeps conventional commits without co-author lines and pushes `feat/web-help-tutorial`; the user opens the PRs.

## Tasks
- [x] T1 Inline help: reusable `DisabledReason`; pure blocker functions (face-swap, karaoke, music-video phase 2) with unit tests; wire into pages; explicit `tone` on Notice usage instead of `includes("correctamente")`; clearer error copy
- [x] T2 Tour foundation: add `driver.js`; `src/tour/` (snapshot, sameInputs, missions, storage, tourSelector) with unit tests; `data-tour` anchors (~11)
- [ ] T3 Tour runner + UI: TourProvider, TourProjectBridge, welcome, MissionChecklist, micro-tours, exit/Esc, reduced-motion, dark theme styling
- [ ] T4 `/help` page: typed content per flow, route in App.tsx, link inside existing Sidebar nav, "Repetir tutorial"
- [ ] T5 (optional) Playwright e2e of the tour path

## Route declaration
Each task: delegated direct (one bounded writer, sequential). Trigger: writer trigger (2+ non-trivial files).

## Progress
T1 and T2 done, verified, reviewed and pushed. Running authored count: 477 lines (> 400 budget): chain strategy decided (PRs to `refactor/web-adjustments`, opened by the user).

## Evidence (commit per task)
- T1: 640afb4 feat(web): explain disabled actions with inline requirement hints (15 files, +408/-69; new DisabledReason, shared/lib/blockers, karaoke-state; getFaceSwapBlockers/getPlanBlockers/getProduceBlockers; explicit Notice tone in Karaoke/Files/ProjectOverview). Checks: build OK; lint 0 errors, 6 warnings (baseline); unit tests 63 passed (baseline 48; parent re-run 63 passed); prettier clean on touched files. Disabled equivalence: face swap checked against legacy expression over 2^7 combinations. Intentional change: "Generacion de karaoke iniciada." now shows success tone (was error).
- T1 review: assessed medium (slice_budget_reached, 477 lines); consent granted by the user; native review (reliability lens) approved, authority burned (lineage review-0c40e5801545b107). Reviewed boundary advances to 640afb4.
- Route: delegated direct (one writer), trigger: writer trigger.

- T2: 9eaab5d feat(web): add tour foundation with missions, storage and anchors (18 files, +727/-2; tests are about half; driver.js 1.14.0 pinned, not imported yet; src/tour/{anchors,snapshot,missions,storage}; 11 data-tour anchors; FileUpload and MediaPlayer got an optional additive `anchor` prop). Checks: build OK; lint 0 errors, 6 warnings; unit tests 88 passed (baseline 63; parent re-run 88). Note: `projectCount` is not derived by snapshotFromProject; the T3 provider/bridge must supply it.
- T2 review: assessed medium (slice 792 lines incl. doc commit, configuration_change in package-lock.json); consent granted by the user; native review (reliability) approved, authority burned (lineage review-91fa384d6414b7a0). Reviewed boundary advances to 9eaab5d.

## Follow-ups (advisory, non-blocking, from the reviews)
- T2 review R3-001 (WARNING): add a render test proving `data-tour` reaches the DOM through Button/FileUpload/MediaPlayer (tourSelector matches a rendered element). Fold into T3.
- R3-001: extract a pure tone helper with a unit test for the Karaoke/Files/ProjectOverview Notice tone mapping.
- R3-002: DisabledReason: always render the live-region container so screen readers announce later changes.

## Next step
T3.
