# Test Report

Run on 2026-11-10 after the redesign into a scroll-driven experience. Windows 11, Node 24.13.0,
Chromium (Playwright 1.65, headless shell 1254). Every result below comes from running the
commands; nothing is skipped or marked `.only`/`.skip`.

| Check | Command | Result |
| --- | --- | --- |
| Lint | `npm run lint` (oxlint) | 0 warnings, 0 errors |
| Type-check | `npm run typecheck` (`tsc -b`, TypeScript 7) | pass |
| Unit + component | `npm test` (Vitest 5, jsdom) | **78 / 78 passed**, 4 files |
| End-to-end | `npm run test:e2e` (build + Playwright) | **15 / 15 passed** |
| Production build | `npm run build` | pass |

## Numerical core — `src/algorithms/algorithms.test.ts` (25, unchanged by the redesign)

Validation (sorting without mutation, duplicate and near-duplicate nodes, non-finite values, too
few nodes); Lagrange (exact cubic recovery, node reproduction, basis sums to 1 and Kronecker
property, hand-worked example, extrapolation and degree cap rejected, uneven spacing); Newton
(divided-difference table against hand values, nested evaluation, agreement with Lagrange);
natural cubic spline (interpolation, continuity of S, S′, S″ at interior knots, S″ = 0 at the
ends, exact straight line, reported system satisfied, two-node case); node selection.

## Data, pipeline and evaluation — `src/data/data.test.ts` (26, unchanged)

Seeded generator; masks (share, endpoints kept, bursts); isolation (reconstructions unchanged when
every ground-truth value is replaced by −999; only observed records become nodes); reconstruction
pipeline; MAE/RMSE/max error against hand values and invalid sets; accuracy experiment including
the Lagrange/Newton tie; CSV parsing and every error type with line numbers; probe simulator.

## Experience logic — `src/experience/experience.test.ts` (17, new)

* Story timeline: scene layout, position → scene/progress/fade-in, exactly two scenes during a
  cross-fade, beat stepping in both directions, sub-step mapping.
* Number store notifies only on change.
* Keyboard: Space/arrows/PageUp/PageDown/Shift+Space, scene keys, P/M/+/−/R/Home/N/F; ignored in
  form fields, with modifiers, and for scene numbers that do not exist; Space on a button presses it.
* Preparation pipeline: rejects exactly the four injected faults with reasons; arrives out of
  order and sorts; reproduces the observed dataset exactly (values and missing records); keeps
  the original of a duplicate; works for CSV data.
* Interpolation helpers: Lagrange basis functions equal the values in the sum; Newton partial
  polynomials interpolate their first k+1 nodes and end at the full polynomial; focus-gap choice.
* Network profile: loss rate within 3 percentage points of the requested 20 % over 2000 probes;
  heavier load raises mean RTT.

## Scenes and shell — `src/scenes/scenes.test.tsx` (10, new)

* Shell: opens on the live network, keyboard jumps and Home; presenter notes outside the stage
  and the fullscreen root, listing the scene's steps; every control present; pause, speed and
  reduced-motion state.
* Each scene at fixed progress shows algorithm output: scene 1 gaps equal the timeout readout;
  scene 2 vanished points and computed coverage; scene 3 counts and all four rejection reasons;
  scene 4 estimates equal `reconstruct()` for Lagrange, Newton and spline, and Lagrange = Newton
  in Compare; scene 5 every estimate drawn and logged with the pipeline's value; scene 6 running
  MAE/RMSE/max equal the evaluation module; scene 7 summary and credits.

## End-to-end — `e2e/presentation.spec.ts` (15)

1. The landing is live: the probe counter rises and packet dots move within seconds; no errors.
2. Nothing advances after six idle seconds.
3. The mouse wheel moves through the story and cross-fades scene 1 into scene 2.
4. Keyboard: Space/↓/↑ step beats (including a quick second press), → changes scene, digits jump, Home restarts.
5. All seven scenes render with the right titles and no page or console errors; screenshots attached.
6. Pause freezes the simulation (counter constant for 2.5 s); Resume continues it.
7. Speed 2× produces at least five probes in three seconds.
8. Reduced motion stops ambient animation; steps land instantly on finished constructions.
9. Scene 4 tabs drive the scroll; the Newton table and estimate appear; Compare shows Lagrange = Newton.
10. Fullscreen contains only the stage and controls; notes are excluded and return afterwards.
11. Notes in a separate window follow the story; keys pressed there drive it.
12. CSV with a duplicate timestamp is rejected with its line number; the sample CSV flows through
    reconstruction ("2 of 2 gaps estimated") and evaluation (holdout); no errors.
13–15. 1366 × 768, 1280 × 800 and 390 × 844: no horizontal scroll, 16:9 stage inside the viewport,
    control bar fits; at 1366 × 768 a screenshot of every scene is attached.

## Visual QA

Every step of every scene was screenshotted at 1920 × 1080 by a keyboard walk (34 frames) and
reviewed, plus 1366 × 768 frames. Defects found and fixed: half-empty trace at load; first live
measurement arriving after ~4 s; preparation caption one stage ahead at stage boundaries; faded
chips showing through the clean dataset; Newton expansion overflowing its column; estimate labels
crossing curves; mis-rounded y-axis ticks (42.5 shown as 43); Compare lacking estimate markers and
a visible dashed spline; lollipop labels colliding; clipped bar labels; a second quick Space press
re-targeting the same step; Space re-pressing a mouse-clicked control; floating-point boundary
landing a tab one method early.

## Performance notes

Only scene 1 runs a frame loop, and only while it is on screen, not paused and motion is allowed;
it updates packet positions by setting SVG attributes, not React state. Other scenes animate from
scroll position and GSAP timelines (no idle loop). Scenes not on screen are unmounted. These were
verified by behaviour (pause test), not by profiling on the presenter's RTX 3050 laptop.

## Known gaps

* E2E runs in Chromium only.
* No measurement on the target laptop or projector hardware.
