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
- [x] T2 Step model and copy: `TourStep` gains `action` (exact button/control name) and `fields` (label, what to put, required, limit); popover renders an "Que hacer" line and a fields list via DOM APIs in `onPopoverRender`; rewrite every step so it names the real button/label; shared label constants used by steps/help and checked against rendered components in tests.
- [x] T3 Guided create-project form: anchors in `NewProjectModal` (Nombre, Descripcion, "Crear proyecto"); mission steps continue after "Nuevo proyecto" once the modal appears (late anchor wait); verify overlay/modal focus trap interplay in jsdom as far as possible.
- [ ] T4 Remaining flows: anchors on empty-state dropzones (karaoke video, music, face-swap image/video); music prompt step (label, example, presets, 500 limit); face-swap prerequisite steps (image, video, choose a person, consent); text-only post-"Cantar" guidance (Comenzar a cantar, microfono, nombre, Guardar interpretacion); step 3/6/7 copy mentions the "Falta:" line under disabled buttons.
- [ ] T5 Docs and close: update help-content where wording changed, README mention if needed, this feature doc.

## Route declaration
Each task: delegated direct (one bounded writer, sequential). Trigger: writer trigger (2+ non-trivial files). Mapping: one read-only explorer (done).

## Delivery forecast
~900-1300 authored changed lines across 5 tasks. Chain strategy: reuse the earlier user decision (user opens PRs; assistant commits without co-author and pushes the feature branch). Base: `refactor/web-adjustments`.

## Progress
T1-T3 done and reviewed. T4-T5 pending. Nothing pushed yet for this feature.

## Evidence
- T1: 35b7c73 feat(web): route tour completion notices through toasts with next-step action (10 files, +387/-172; Toast gets optional `action`, hover/focus pause, timer cleanup, status/alert roles, viewport lifted to bottom-20 so it never overlaps the "Guia" button; TourProvider emits "Paso completado" + "Siguiente paso: <title>" with a "Mostrarme" action via `nextHint` copy per mission; TourNotices removed). Checks: build OK; lint 0 errors/6 warnings; unit tests 171 passed (baseline 162).
- T1 review: assessed medium (559 lines, slice_budget_reached); consent granted by the user; native review (reliability) approved with 1 WARNING + 1 SUGGESTION, authority burned (lineage review-ae724e2b9aaefc2f). Reviewed boundary advances to 35b7c73. Both findings fixed in the follow-up commit: tour toasts are dismissed when TourProvider unmounts; Toast tracks hover and focus as separate flags. Follow-up checks: build OK; lint 0 errors/6 warnings; unit tests 173 passed; the unmount test was proven to fail without the fix (mutation check).
- T2: d76f800 feat(web): show exact buttons and fields in tour steps with label drift guard (7 files, +406/-39; `TourStep.action`/`fields`, `UI_LABELS` single source, `renderStepGuide` builds the "Que hacer" block and field list with DOM APIs/textContent, per-step onPopoverRender replaces the global one because driver.js 1.14 ignores the global hook when a step defines its own, light/dark CSS, `ui-labels.test.ts` drift guard reading component sources). Checks: build OK; lint 0 errors/6 warnings; unit tests 197 passed (baseline 173).
- T2 slice review (follow-up 618dc51 + T2): assessed medium (571 lines, slice_budget_reached); consent granted by the user; native review (reliability) approved with 1 SUGGESTION, authority burned (lineage review-068b40bdae140b06). Reviewed boundary advances to d76f800. Suggestion addressed: the drift guard now requires whole-text matches for button/field labels (a rename of "Cantar" is proven to fail), with an explicit PARTIAL_LABELS set for sentence fragments. Checks: build OK; lint 0 errors/6 warnings; 197 tests passed.
- Known source discrepancy (not changed): the karaoke dropzone copy says "MP4, MKV o WebM" but `VIDEO_FILE_ACCEPT` has no MKV; the tour follows the accept constant. FaceSwapPage has a different consent string ("sobre la imagen usada") than ConsentPanel; the tour quotes ConsentPanel.
- T3: 7fff74e feat(web): guide the new project form step by step inside the tour (9 files, +426/-27; anchors project-name/project-description/project-submit applied in NewProjectModal via tourAnchor only; UI_LABELS projectName/projectDescription in the drift guard; `TourStep.late`/`focusTarget`; the runner splits steps into segments and, after the user clicks "Nuevo proyecto", polls (100 ms, 4 s) for the modal anchor and continues the tour inside the modal; if the modal closes or never opens the tour ends quietly; starts at the name step when the modal is already open). Native driver.js `waitForElement` deliberately not used (hard to test, semantics do not map to a quiet end). Checks: build OK; lint 0 errors/6 warnings; unit tests 209 passed (baseline 197); mutation check proved 4 tests fail without the handoff.
- T3 review: assessed medium (488 lines, slice_budget_reached); consent granted by the user; native review (reliability) approved with 1 WARNING + 1 SUGGESTION, authority burned (lineage review-dd0f61597da7a976). Reviewed boundary advances to 7fff74e. WARNING (focus option unproved): `focus` is a real typed step option in driver.js 1.14 (StepFocus "popover"|"element"|"none"), but real focus behavior over the modal is only verifiable in a browser (manual check). SUGGESTION (watchScope and waitThen share one timer slot): unreachable with the current 2-segment mission; open if a 3+ segment mission (late, non-late, late) is ever added.

## Follow-ups (inherited, not in scope)
- Esc during an open modal closes the tour first; floating "Guia" on mobile may cover CTAs; focus falls to body when starting a mission; driver.js in main bundle; dead anchor `project-flows` (T4 may use it); accents in main's UI copy; manual visual check of tour CSS in light/dark.

## Next step
T4 (remaining flows).

Manual checks the user must do for T3 (jsdom cannot): press "Nuevo proyecto" and confirm the popover moves into the modal on the name field; the name input stays typeable and keeps focus; Siguiente reaches Descripcion then "Crear proyecto"; start the mission with the modal already open (should begin at the name step); Esc / "Salir de la guia" / closing the modal mid-tour leaves no overlay or toast; creating the project completes the mission; light, dark and a narrow mobile width.
