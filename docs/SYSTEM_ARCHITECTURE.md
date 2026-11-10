# System Architecture

A single-page React application. No backend, no network calls, no storage: everything runs in
the browser from the static build, so the presentation works offline.

## Layers

```
┌──────────────────────────── experience layer ──────────────────────────────┐
│ ExperienceShell: scroller (ScrollTrigger) → position store → scenes        │
│   sticky Stage (1920×1080, scaled) with 1–2 cross-fading scenes (lazy)     │
│   ExperienceControls · PresenterNotesPanel (drawer or separate window)     │
├──────────────────────────────── state ─────────────────────────────────────┤
│ MotionProvider (paused, speed, reduced) → GSAP global timeline, tickers    │
│ per-scene progress/exit stores (no React re-render unless a scene asks)    │
│ DatasetProvider (bundle, method, nodeCount, holdout, experiment)           │
├──────────────────────────── domain (pure TS) ──────────────────────────────┤
│ simulation/   datasetGenerator · missingData · networkSimulation · random  │
│ data/csv/     parseLatencyCsv                                              │
│ reconstruction/ reconstruct (accepts ObservedDataset only)                 │
│ algorithms/   lagrange · newton · cubicSpline · nodeSelection · shared     │
│ evaluation/   metrics · comparison (artificial-masking experiment)         │
└────────────────────────────────────────────────────────────────────────────┘
```

The domain layer has no React or DOM imports and is unit-tested in isolation.

## Source map

| Path | Responsibility |
| --- | --- |
| `src/app/` | `App` (providers) and the scene registry `scenes.ts` (order, scroll length, beats, notes, lazy loaders) |
| `src/experience/` | Scroll timeline maths, number stores, motion settings and frame ticker, scene context, `ExperienceShell` |
| `src/components/presentation/` | Stage scaling, scene header, presenter notes and window |
| `src/components/navigation/ExperienceControls.tsx` | Step back/forward, scene menu, story rail, pause, speed, reduced motion, replay, restart, presenter mode, fullscreen |
| `src/components/data/DatasetControls.tsx` | Generator form and CSV import |
| `src/components/math/ReconstructionSteps.tsx` | Intermediate values of one estimate |
| `src/components/graphs/` | `LatencyPlot` (custom SVG; animated or scroll-scrubbed curve, scan line), scales |
| `src/components/network/` | Original SVG illustrations: laptop, router, server |
| `src/components/typography/Tex.tsx` | KaTeX rendering |
| `src/scenes/<Name>/` | One folder per scene: component, presenter notes, timing constants |
| `src/algorithms/` | Interpolation methods and validation |
| `src/simulation/` | Seeded PRNG, synthetic series, masks, packet simulation |
| `src/data/` | CSV parsing, preparation pipeline (validate → sort → identify missing), dataset bundle factories |
| `src/reconstruction/` | Pipeline from observed data to estimates and plotted curves; focus-gap choice |
| `src/evaluation/` | Error metrics and the method comparison experiment |
| `src/state/DatasetContext.tsx` | Shared dataset state across scenes |
| `src/types/` | Measurement, interpolation and presentation types |
| `e2e/` | Playwright tests |

## Data model and isolation

```ts
Measurement   { index, timestamp, observedPingMs | null, reconstructedPingMs | null, status }
ObservedDataset { kind: 'observed', label, measurements }      // → algorithms
GroundTruth     { kind: 'ground-truth', values: Map<index, ms> } // → evaluation only
DatasetBundle   { source, observed, groundTruth, missingIndices }
```

The brief's suggested `actualPingMs` field was deliberately moved out of `Measurement` into
`GroundTruth`. `reconstruct(observed, indices, options)` cannot receive the truth through its
signature, and missing rows carry `observedPingMs: null`. A unit test replaces every
ground-truth value with −999 and confirms the reconstructions are unchanged.

Reconstructed values are kept in a separate map and merged for display
(`mergeReconstructions`); they are never used as interpolation nodes.

## Experience engine

**One position, many scenes.** A tall scroll container provides the story's timeline. One
ScrollTrigger on that scroller writes the scroll position (in screens) into a number store.
`timeline.ts` maps the position to the active scene, its content progress (0–1) and the
cross-fade with the previous scene; the shell writes those into per-scene stores and sets the
wrappers' opacity directly, so scrolling does not re-render the tree. Only the one or two scenes on
screen are mounted.

**Scenes read progress three ways.** `useStoreValue` re-renders light SVG scenes every frame;
`useStoreSelector` re-renders only when a derived value (for example the current step) changes;
`useStoreListener` drives GSAP timelines with `timeline.progress(p)` without re-rendering
(scene 3's pipeline).

**Presenter control.** Nothing moves the position on a timer. Wheel and touch scroll it directly.
Keyboard and buttons move to the next beat with a short eased animation whose duration is set per
beat (constructions take several seconds so they read as animation) and scaled by the speed
setting; it freezes while paused and is cancelled by the wheel. A second press during a step
continues from the step's target.

**Motion settings.** `MotionProvider` holds paused, speed and reduced motion. GSAP's global
timeline follows pause and speed. Scene 1's simulation uses `useTicker`, a `requestAnimationFrame`
loop that exists only while the scene is mounted and `playing` (not paused, motion allowed). With
reduced motion, ambient animation stops and steps jump instantly; scroll-driven drawing still
follows the presenter's scrolling.

**Fullscreen and notes.** Fullscreen targets the root holding the scroller, stage and overlay
controls. The notes drawer is outside it; the notes window is a React portal into a popup whose key
presses also drive the story.

**Replay and restart** remount the scene(s) (resetting the simulation and GSAP contexts) and jump
to the scene start or the beginning.

## Rendering decisions

* The stage is a fixed 1920 × 1080 canvas scaled with a CSS transform, so a laptop rehearsal and
  the projector show the identical composition.
* Everything is SVG: the network, packets, plots, basis curves, divided-difference morphs, spline
  segments, error bars and comparison bars. Curves reveal with `pathLength` and dash offsets driven
  by progress. Canvas was not needed at these element counts (under ~300 per scene).
* No WebGL or Three.js: no concept here is three-dimensional, and a WebGL loop would cost power on
  a laptop for no explanatory gain.
* Scenes are lazy-loaded; KaTeX and GSAP land in separate chunks. Fonts are bundled via Fontsource.
* Recharts was removed in the redesign: its built-in animation cannot follow scroll progress.

## Dependencies

| Package | Why | Licence |
| --- | --- | --- |
| react, react-dom | UI | MIT |
| gsap, @gsap/react (incl. ScrollTrigger) | Scroll source, scrubbed timelines, cleanup via `useGSAP` | GSAP standard licence (free, including commercial use) |
| katex | Equation typesetting | MIT |
| papaparse | Robust CSV tokenising | MIT |
| @fontsource-variable/* | Newsreader, Public Sans, JetBrains Mono, offline | OFL-1.1 |
| tailwindcss | Utility styling with design tokens | MIT |
| vitest, @testing-library/*, jsdom, @playwright/test | Testing | MIT / Apache-2.0 |
