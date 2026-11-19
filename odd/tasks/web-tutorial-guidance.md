# Feature: web-tutorial-guidance

Branch: `feat/web-tutorial-guidance` (from `refactor/web-adjustments` at 156c9b7)
Scope: `web/` only. Builds on `odd/tasks/web-help-tutorial.md` (tour, help page, inline blockers).

## Objective
Make the tutorial tell the user exactly what to do: clearer completion notices, concrete step copy (button names, which fields to fill and with what, limits and examples), guidance for forms (project name, visual direction, consent) and for button-only actions, with maintainable code.

## Problem (from the read-only mapping, user-confirmed)
- Completion notices carry only a message: no title, no next-step instruction, no CTA, no manual dismiss, fixed 6 s timer with no pause (TourNotices). A second notification system exists (Toast) with different position/z-index/a11y.
- User screenshot (`img/img1.jpeg`, untracked, not to be committed): the two tour notices stack bottom-center OVER the video player (covering its controls and file name); flat boxes with no icon/title; "Siguiente paso" renders dark amber on a dark background (low contrast); "Video subido." duplicates the page message right above it; it says what is next but not how, and has no button to go there. The floating "Guia 2/7" button is white in dark mode (inconsistent with the theme).
- Steps explain "why", not "what to do": buttons are not named, fields/values/limits are missing.
- create-project: the tour stops at "Nuevo proyecto"; the modal (Nombre required, Descripcion optional, Foto optional, "Crear proyecto") is not guided.
- Music prompt: label, example, presets and 500-char limit not mentioned. Face swap: prerequisites (image, video, choose a person) not guided. Empty-state dropzones have no anchors. sing-karaoke modal flow has zero guidance (modal must not be highlighted).
- Maintainability: the same instructions live in steps.ts, missions.ts and help-content.ts; UI labels are literals repeated across files; tests do not check label correctness.

## Constraints
- Additive; reuse `Toast`, `Notice`, `Panel`, `Button`, `cn` before creating components. Extend `Toast` additively (optional `action`), do not fork a third notification system.
- Do not highlight anything inside `KaraokeSingingModal` (text-only guidance in the "Cantar" step).
- E2E landmarks unchanged: one `navigation`, no new `<aside>`; "Mi perfil" and "Proyectos" links unique.
- driver.js popover description is injected as HTML: build rich content with DOM APIs (`textContent`), never interpolate untrusted strings into innerHTML.
- Tour copy in Spanish WITHOUT accents (project convention for tour/help); code and comments in English. No Co-Authored-By or AI attribution in commits.
- Conventional Commits; one work-unit commit per task with its tests; about 400 authored changed lines per task is advisory.
- localStorage always in try/catch; no change to the `tiluchi_tour_v1` key shape without migration.

## Resolved mode
- TDD: not enabled. Ordinary functional checks. Runner: Vitest. From `web/`: `npm run build`, `npm run lint` (baseline 0 errors / 6 warnings), `npm run test:unit` (baseline 162 passed). Prettier check on touched files only (CRLF baseline on others).
- Skills: `work-unit-commits`.

## Decision (assistant, recorded for review)
Consolidate tour notices into the existing `Toast` system (extended with optional `action`, hover/focus pause and timer cleanup) and retire the separate `TourNotices` stack, instead of polishing two parallel systems.

## Tasks
- [x] T1 Notifications: extend `Toast` additively (optional `action {label,onClick}`, pause on hover/focus, timer cleanup on unmount, consistent live-region role); `TourProvider` emits completion toasts through `useToast` with a title ("Paso completado"), the mission message, and a next-step toast whose message says what to do and whose action starts the mission; unavailable notices go through the same channel; remove `TourNotices` and update tests.
- [ ] T2 Step model and copy: `TourStep` gains `action` (exact button/control name) and `fields` (label, what to put, required, limit); popover renders an "Que hacer" line and a fields list via DOM APIs in `onPopoverRender`; rewrite every step so it names the real button/label; shared label constants used by steps/help and checked against rendered components in tests.
- [ ] T3 Guided create-project form: anchors in `NewProjectModal` (Nombre, Descripcion, "Crear proyecto"); mission steps continue after "Nuevo proyecto" once the modal appears (late anchor wait); verify overlay/modal focus trap interplay in jsdom as far as possible.
- [ ] T4 Remaining flows: anchors on empty-state dropzones (karaoke video, music, face-swap image/video); music prompt step (label, example, presets, 500 limit); face-swap prerequisite steps (image, video, choose a person, consent); text-only post-"Cantar" guidance (Comenzar a cantar, microfono, nombre, Guardar interpretacion); step 3/6/7 copy mentions the "Falta:" line under disabled buttons.
- [ ] T5 Docs and close: update help-content where wording changed, README mention if needed, this feature doc.

## Route declaration
Each task: delegated direct (one bounded writer, sequential). Trigger: writer trigger (2+ non-trivial files). Mapping: one read-only explorer (done).

## Delivery forecast
~900-1300 authored changed lines across 5 tasks. Chain strategy: reuse the earlier user decision (user opens PRs; assistant commits without co-author and pushes the feature branch). Base: `refactor/web-adjustments`.

## Progress
T1 done, reviewed and pushed-ready. T2-T5 pending.

## Evidence
- T1: 35b7c73 feat(web): route tour completion notices through toasts with next-step action (10 files, +387/-172; Toast gets optional `action`, hover/focus pause, timer cleanup, status/alert roles, viewport lifted to bottom-20 so it never overlaps the "Guia" button; TourProvider emits "Paso completado" + "Siguiente paso: <title>" with a "Mostrarme" action via `nextHint` copy per mission; TourNotices removed). Checks: build OK; lint 0 errors/6 warnings; unit tests 171 passed (baseline 162).
- T1 review: assessed medium (559 lines, slice_budget_reached); consent granted by the user; native review (reliability) approved with 1 WARNING + 1 SUGGESTION, authority burned (lineage review-ae724e2b9aaefc2f). Reviewed boundary advances to 35b7c73. Both findings fixed in the follow-up commit: tour toasts are dismissed when TourProvider unmounts; Toast tracks hover and focus as separate flags. Follow-up checks: build OK; lint 0 errors/6 warnings; unit tests 173 passed; the unmount test was proven to fail without the fix (mutation check).

## Follow-ups (inherited, not in scope)
- Esc during an open modal closes the tour first; floating "Guia" on mobile may cover CTAs; focus falls to body when starting a mission; driver.js in main bundle; dead anchor `project-flows` (T4 may use it); accents in main's UI copy; manual visual check of tour CSS in light/dark.

## Next step
T2 (step model and copy).
