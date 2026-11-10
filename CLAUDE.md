# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Ritmera: a local-first Angular 20 PWA (standalone components, no NgModules) for building and running interval-timer routines (HIIT, Tabata, EMOM, Pomodoro). No backend — all data lives in IndexedDB via Dexie. UI text, routes, comments and the README are in Spanish; keep new user-facing copy in Spanish.

## Commands

```bash
npm start                 # dev server at http://localhost:4200
npm run build             # production build -> dist/ritmera/browser (includes service worker)
npm test                  # Jest unit tests (src/**/*.spec.ts)
npx jest src/app/core/timer-engine/timer-engine.utils.spec.ts   # single test file
npx jest -t "partial test name"                                  # single test by name
npm run test:e2e          # Playwright (e2e/), auto-starts `npm start`, runs Pixel 5 + Desktop Chrome
npx playwright test --project="Desktop Chrome" -g "Abre la aplicación"
```

Angular CLI needs Node ≥ 20.19 (`.node-version` pins 20.19.0); older Node aborts `ng build`/`ng serve`.

Karma/Jasmine packages are leftovers from the Angular scaffold; Jest is the real unit runner.

## Architecture

- `src/app/core/timer-engine/` — the heart of the app, deliberately UI-agnostic.
  - `timer-engine.utils.ts`: pure functions (`expandRoutineSteps` flattens blocks × repetitions + inter-round rests into a flat `ExpandedStep[]`; `computeCurrentStep` recovers position after tab suspension; duration calc; formatting).
  - `timer-engine.service.ts`: state machine (`idle | running | paused | completed | cancelled`) exposed as RxJS `session$`, `tick$`, `events$`. Time is driven by absolute epoch deadlines (`stepDeadlineAt` / `Date.now()`), never by accumulated `setInterval` counts; a rAF loop only renders. On `visibilitychange`/`pageshow` it fast-forwards past expired steps. A `_transitioning` flag guards against double "next" clicks.
  - A session takes an immutable `routineSnapshot` at start; editing the routine must not affect a running session.
- `src/app/core/persistence/` — Dexie DB (`RitmeraDB`) wrapped by repositories (routine, session, settings). The IndexedDB name is still `intervala-db` (old brand) on purpose so existing user data survives — do not rename it. Schema changes need a new `this.version(n)` step, not an edit to version 1. Tables: `routines`, `history`, `activeSessions` (active session restored on reload), `settings`.
- `src/app/core/pwa/` — `ExportImportService` (versioned JSON backup, `SCHEMA_VERSION`, 10 MB limit, duplicate strategies skip/overwrite/copy) and Wake Lock.
- `src/app/core/audio/` — Web Audio synthesized beeps (no audio files) and SpeechSynthesis; both degrade silently when unsupported.
- `src/app/features/*` — lazy-loaded route components (see `app.routes.ts`: `/biblioteca`, `/rutina/nueva`, `/rutina/:id/editar`, `/temporizador/:id`, `/temporizador-rapido`, `/historial`, `/ajustes`). Each feature is a single `.ts` file with an inline template.
- `src/app/shared/` — `DurationInputComponent` (ControlValueAccessor, minutes+seconds), `ConfirmDialog`, `EmptyState`, `DurationPipe`. `shared/utils/duration.utils.ts` just re-exports from timer-engine utils.
- Styling: plain CSS with design tokens in `src/styles/_tokens.css` (light/dark themes). No UI component library — keep it that way.

## Testing notes

- Jest maps `@angular/core` to `src/__mocks__/@angular/core.ts` (stub `Injectable`, `NgZone`, `OnDestroy`), so unit tests instantiate services directly without TestBed. Anything in core services that imports more from `@angular/core` needs the mock extended.
- Time-dependent tests use `@sinonjs/fake-timers`.
- E2E expects 4 seeded default templates (`timer-engine.templates.ts`) and branches on viewport width (<1024px uses the mobile FAB + action sheet).
