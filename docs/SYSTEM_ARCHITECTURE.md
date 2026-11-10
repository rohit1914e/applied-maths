# System Architecture

A single-page React application. No backend, no network calls, no storage: everything runs in
the browser from the static build, so the presentation works offline.

## Layers

```
┌───────────────────────────── website (React) ──────────────────────────────┐
│ App: Navbar (sticky, scrollspy, mobile menu) · Hero · 7 sections · Footer  │
│ sections: Simulation · MissingData · Dataset · Methods · Reconstruction ·  │
│           Evaluation · Conclusion          (src/site/, src/site/sections/) │
│ shared components: LatencyPlot, LiveNetwork, LiveTrace, DatasetControls,   │
│                    ReconstructionSteps, Tex                                │
├──────────────────────────────── state ─────────────────────────────────────┤
│ DatasetProvider (bundle, method, nodeCount, holdout, accuracy experiment)  │
│ hooks: useInView, useFirstView, useElementWidth, useConstruction,          │
│        useReducedMotion                                                    │
├──────────────────────────── domain (pure TS) ──────────────────────────────┤
│ simulation/   datasetGenerator · missingData · networkSimulation           │
│               (probe model + live engine) · random                         │
│ data/         csv · preparation pipeline · bundle factories                │
│ reconstruction/ reconstruct (ObservedDataset only) · focus                 │
│ algorithms/   lagrange · newton · cubicSpline · nodeSelection · shared     │
│ evaluation/   metrics · comparison (artificial-masking experiment)         │
└────────────────────────────────────────────────────────────────────────────┘
```

The domain layer has no React or DOM imports and is unit-tested in isolation.

## Source map

| Path | Responsibility |
| --- | --- |
| `src/app/App.tsx` | Providers, page composition, scroll-triggered reveals (GSAP ScrollTrigger batch) |
| `src/site/` | `Navbar`, `navLinks`, `Hero`, `Section` and `Stat` building blocks |
| `src/site/sections/` | One component per section; `methodsModel.ts` computes everything the methods panels draw |
| `src/components/graphs/` | `LatencyPlot` (responsive SVG, hover tooltip, animated or progress-driven curve, highlight/fade), scales |
| `src/components/network/` | `LiveNetwork` (topology and packets), `LiveTrace` (live RTT chart), device drawings |
| `src/components/data/DatasetControls.tsx` | Generator form and CSV import |
| `src/components/math/ReconstructionSteps.tsx` | Intermediate values of one estimate |
| `src/components/typography/Tex.tsx` | KaTeX rendering |
| `src/hooks/` | Viewport visibility, first view, element width, GSAP-driven construction progress, reduced motion |
| `src/simulation/networkSimulation/liveEngine.ts` | Pure live-ping engine: launches probes, advances packets, records RTTs and timeouts |
| `src/algorithms/`, `src/data/`, `src/reconstruction/`, `src/evaluation/` | Numerical core, data handling, pipeline and metrics (unchanged by the redesigns) |
| `src/state/DatasetContext.tsx` | Shared dataset state across sections |
| `e2e/website.spec.ts` | Playwright tests |

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

## Website behaviour

**Layout.** A normal document: sticky navbar (64 px), sections with a 1400 px content width and
responsive grids. Charts measure their container with `ResizeObserver` and draw at real pixel size,
so text stays readable from 390 px to 1920 px; SVGs are capped at their container width so an
unmeasured chart cannot widen a mobile layout.

**Navigation.** Anchor links with CSS smooth scrolling (`scroll-padding-top` clears the navbar). An
`IntersectionObserver` marks the section in the middle of the viewport as current.

**Animation.**
* Section content fades up once on entering the viewport (`ScrollTrigger.batch`).
* The live network runs a `requestAnimationFrame` loop only while its panel is visible and not
  paused; the engine decides every RTT and timeout, the component only moves SVG dots.
* Constructions (series build-up, measurements fading out, Lagrange basis curves, Newton partial
  polynomials morphing, spline segments, the reconstruction sweep, bar growth) are a 0 → 1 progress
  tweened by GSAP (`useConstruction`) and started the first time their section is seen. The chart
  draws whatever the progress says, from the algorithms' real output.
* `prefers-reduced-motion`: reveals are skipped, simulations start paused and every construction
  shows its finished state.

**Interaction.** Simulation controls (pause, reset, speed, loss rate), complete/incomplete toggle,
dataset generator and CSV import, method tabs, missing-point and node-count selection, replay
buttons, original/reconstructed toggle, gap and table selection, evaluation method toggle, CSV
holdout, chart hover tooltips.

## Rendering decisions

* Everything is SVG; element counts stay in the hundreds, so Canvas was not needed. Measured about
  60 fps at 1920 × 1080 in every animated section.
* No WebGL or Three.js: nothing here is three-dimensional.
* KaTeX and GSAP are split into their own chunks; fonts are bundled via Fontsource.

## Dependencies

| Package | Why | Licence |
| --- | --- | --- |
| react, react-dom | UI | MIT |
| gsap, @gsap/react (incl. ScrollTrigger) | Scroll reveals, construction tweens, cleanup via `useGSAP` | GSAP standard licence (free, including commercial use) |
| katex | Equation typesetting | MIT |
| papaparse | Robust CSV tokenising | MIT |
| @fontsource-variable/* | Newsreader, Public Sans, JetBrains Mono, offline | OFL-1.1 |
| tailwindcss | Utility styling with design tokens | MIT |
| vitest, @testing-library/*, jsdom, @playwright/test | Testing | MIT / Apache-2.0 |
