# Implementation Plan

## Phase 1 — Inspect
The workspace (`Desktop/numerical maths`) was empty. Scaffolded with `create-vite` 9
(React + TypeScript template: Vite 8, React 19, TypeScript 7, oxlint). No existing work to preserve.

## Phase 2 — Foundation
* Design tokens in `src/styles/index.css` (Tailwind v4 `@theme`): ivory, crimson, brown,
  amber, charcoal, plus a warm dark "night" surface for transmission scenes.
* Bundled fonts: Newsreader (serif headings), Public Sans (body), JetBrains Mono (numbers).
* `Stage` renders a fixed 1920 × 1080 design canvas scaled to fit — identical composition on
  laptop and projector.
* `PresentationShell` + `usePresentation` reducer: chapter index, build step, paused,
  notes, replay key. Keyboard hook ignores keys typed into form fields.

## Phase 3 — Chapters
One folder per chapter under `src/chapters/`, each exporting a component, its build count
and presenter notes. Chapters are lazy-loaded; only the active chapter is mounted so its
GSAP context is reverted on exit.

## Phase 4 — Numerical core (test first)
`src/algorithms/`: shared validation + tolerances, Lagrange, Newton, natural cubic spline,
node selection. Unit tests written before the UI uses them.

## Phase 5 — Data and evaluation
`src/simulation/` (PRNG, generator, masks, packet simulation), `src/data/csv/`,
`src/reconstruction/` (pipeline that accepts only the observed dataset),
`src/evaluation/` (metrics, method comparison).

## Phase 6 — Integration
`DatasetProvider` holds the active bundle (observed + sealed ground truth). Chapters 5–8
read live algorithm output; no mock numbers.

## Phase 7 — QA
oxlint, `tsc -b`, Vitest (unit + component), Playwright E2E at 1920 × 1080 with
screenshots reviewed, production build.

## Phase 8 — Docs and delivery
Remaining docs, test report with real counts, user guide, viva questions.

## Key decisions
| Decision | Reason |
| --- | --- |
| Custom SVG for every visual | Plots need gap markers, scroll-scrubbed drawing and exact control under canvas scaling |
| Local node window for Lagrange/Newton (default 4 nodes, cap 10) | A global polynomial through 40+ points oscillates (Runge); both methods receive the identical window |
| Spline uses all observed points | Piecewise cubic stays stable at any size |
| Endpoints are never masked | Interpolation is not defined outside the node range; extrapolation is rejected |
| Notes in an off-stage drawer and an optional presenter window | Fullscreen targets the stage element only, so notes can't reach the projector |
| No React Three Fiber | No concept here benefits from 3D; it would add weight and an idle render loop |

## Redesign (2026-11-10): from slides to a living, scroll-driven story

Feedback: the first build felt like a slideshow. The presentation layer was replaced while the
numerical core, data, CSV import and evaluation were kept unchanged (their 51 tests still pass).

| Before | After |
| --- | --- |
| 8 chapters, one mounted at a time, Space reveals builds | 7 scenes on one scroll timeline, cross-fading; Space steps between beats with eased motion |
| Static title screen | Live network simulation (packets, RTT readouts, trace, timeouts) on load |
| Chapter-by-chapter mock-free values | Same: every number from the algorithms, now animated as constructions |
| Recharts bars | Custom SVG bars that grow with scroll |
| Pause, replay | Pause, speed 0.5–2×, reduced-motion toggle, replay scene, restart, presenter mode |

Added modules: `src/experience/*`, `src/scenes/*`, `src/data/preparation/preparationPipeline.ts`,
`src/reconstruction/focus.ts`, `lagrangeBasisFunction`, `newtonPartialPolynomial`, and a network
profile (loss probability, load over time) for the probe simulator. New tests: 17 experience/pipeline
tests, 10 scene/shell tests, a rewritten 15-test Playwright suite.
