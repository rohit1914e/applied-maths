# System Architecture

A single-page React application. No backend, no network calls, no storage: everything runs in
the browser from the static build, so the presentation works offline.

## Layers

```
┌──────────────────────────── presentation layer ────────────────────────────┐
│ PresentationShell ─ Stage (1920×1080 canvas, scaled) ─ ControlBar          │
│        │            └─ active chapter (lazy, remounted on replay)          │
│        └─ PresenterNotesPanel (drawer or separate window, never on stage)  │
├──────────────────────────────── state ─────────────────────────────────────┤
│ presentationReducer (chapter, build, paused, notes, replayKey)             │
│ DatasetProvider (bundle, method, nodeCount, reconstructions, experiment)   │
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
| `src/app/` | `App` (providers) and the chapter registry `chapters.ts` (order, builds, notes, lazy loaders) |
| `src/components/presentation/` | Stage scaling, shell, chapter frame, presenter notes and window, controller reducer |
| `src/components/navigation/ControlBar.tsx` | Previous/next, chapter menu, progress, build button, replay, pause, notes, fullscreen, restart |
| `src/components/graphs/` | `LatencyPlot` (custom SVG with GSAP curve drawing), `TraceMotif`, scales |
| `src/components/network/` | Original SVG illustrations: topology, laptop, router, server |
| `src/components/typography/Tex.tsx` | KaTeX rendering |
| `src/chapters/<Name>/` | One folder per chapter: component + presenter notes |
| `src/algorithms/` | Interpolation methods and validation |
| `src/simulation/` | Seeded PRNG, synthetic series, masks, packet simulation |
| `src/data/` | CSV parsing, dataset bundle factories, chapter 3 example |
| `src/reconstruction/` | Pipeline from observed data to estimates and plotted curves |
| `src/evaluation/` | Error metrics and the method comparison experiment |
| `src/state/DatasetContext.tsx` | Shared dataset state across chapters 4–8 |
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

## Presentation controller

`presentationReducer` is a pure function of (state, action, build counts). There is no timer
anywhere that dispatches actions, so chapters cannot advance on their own (verified by an E2E
test that waits six seconds). Space walks a chapter's builds, then moves to the next chapter.

* **Fullscreen** targets `presentation-root` (stage + overlay control bar). The notes drawer is a
  sibling outside it, so it cannot appear in fullscreen output.
* **Presenter window** renders the notes through a React portal into a `window.open` popup,
  with styles copied across; key presses in that window also drive the presentation.
* **Pause** calls `gsap.globalTimeline.pause()`; every chapter timeline is a child of it.
* **Replay** bumps `replayKey`, remounting the chapter; `useGSAP` reverts its context on unmount.
* **Reduced motion** (`prefers-reduced-motion`) makes every timeline skip to its end state.

## Rendering decisions

* The stage is a fixed 1920 × 1080 canvas scaled with a CSS transform, so a laptop rehearsal
  and the projector show the identical composition.
* Latency plots are custom SVG: exact gap markers, node rings and GSAP stroke drawing.
  Recharts draws the method comparison bars in chapter 7 with fixed dimensions (no
  `ResponsiveContainer`, which would mis-measure under the canvas transform).
* No WebGL: React Three Fiber was considered and rejected — no concept here needs 3D, and it
  would add a continuous render loop.
* Chapters are lazy-loaded; KaTeX and Recharts land in separate chunks. Fonts are bundled via
  Fontsource (no Google Fonts request).

## Dependencies

| Package | Why | Licence |
| --- | --- | --- |
| react, react-dom | UI | MIT |
| gsap, @gsap/react | Controlled timelines, cleanup via `useGSAP` | GSAP standard licence (free, including commercial use) |
| recharts | Comparison bar chart | MIT |
| katex | Equation typesetting | MIT |
| papaparse | Robust CSV tokenising | MIT |
| @fontsource-variable/* | Newsreader, Public Sans, JetBrains Mono, offline | OFL-1.1 |
| tailwindcss | Utility styling with design tokens | MIT |
| vitest, @testing-library/*, jsdom, @playwright/test | Testing | MIT / Apache-2.0 |
