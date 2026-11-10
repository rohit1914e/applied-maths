# Test Report

Run on 2026-11-10 after the website redesign. Windows 11, Node 24.13.0, Chromium (Playwright
1.65, headless shell 1254). Every result below comes from running the commands; nothing is
skipped or marked `.only`/`.skip`.

| Check | Command | Result |
| --- | --- | --- |
| Lint | `npm run lint` (oxlint) | 0 warnings, 0 errors |
| Type-check | `npm run typecheck` (`tsc -b`, TypeScript 7) | pass |
| Unit + component | `npm test` (Vitest 5, jsdom) | **78 / 78 passed**, 5 files |
| End-to-end | `npm run test:e2e` (build + Playwright, 3 workers) | **14 / 14 passed** |
| Production build | `npm run build` | pass |

## Numerical core — `src/algorithms/algorithms.test.ts` (25, unchanged)

Validation (sorted copy, duplicate and near-duplicate nodes, non-finite values, too few nodes);
Lagrange (exact cubic recovery, node reproduction, basis sums to 1 and Kronecker property,
hand-worked example, extrapolation and degree cap rejected, uneven spacing); Newton (table against
hand values, nested evaluation, agreement with Lagrange); natural cubic spline (interpolation,
continuity of S, S′, S″, natural ends, exact straight line, reported system satisfied, two-node
case); node selection.

## Data, pipeline and evaluation — `src/data/data.test.ts` (26, unchanged)

Seeded generator; masks; ground-truth isolation (reconstructions unchanged when every truth value is
replaced by −999; only observed records become nodes); reconstruction pipeline; MAE/RMSE/max error
against hand values and invalid sets; accuracy experiment including the Lagrange/Newton tie; CSV
parsing and every error type with line numbers; probe simulator.

## Preparation pipeline and helpers — `src/data/pipeline.test.ts` (9)

Exactly the four injected faults rejected with reasons; out-of-order arrival sorted; output equals
the observed dataset (values and missing records); first of a duplicate kept; works for CSV data;
Lagrange basis functions equal the values in the sum; Newton partial polynomials; focus-gap
choice; network profile loss rate and load.

## Live network engine — `src/simulation/networkSimulation/liveEngine.test.ts` (8, new)

Full trace and probes in flight at start; about one probe per simulated second with a fixed window;
deterministic per seed; every packet position stays between client and server; loss rate 0 and 1
produce no and only timeouts; hop durations clamped; mean and jitter skip timeouts; empty trace.

## Website — `src/site/site.test.tsx` (10, new)

* Structure: navigation with six links whose targets exist, hero heading and call to action, all
  sections present, **no presentation toolbar and no fixed stage**; mobile menu opens and closes.
* Hero metrics come from the simulation; simulation pause/resume/speed/reset and loss slider; the
  number of trace gaps equals the timeout count.
* Missing data toggle highlights exactly the masked records, then shows them as gaps.
* Dataset table has one row per record and one "Missing" badge per gap; all four rejection reasons;
  CSV import rejects a negative latency with its line number, then updates the table and the
  reconstruction section.
* Methods: Lagrange, Newton and spline estimates equal `reconstruct()`; changing the missing point
  changes the estimate to the algorithm's value for that point.
* Reconstruction: every gap drawn and listed with the pipeline's value; Original hides estimates;
  switching to Lagrange shows Lagrange's values.
* Evaluation cards equal the evaluation module; "Lowest RMSE" only on the tied-best methods; key
  findings contain the best RMSE; credits in the footer.

## End-to-end — `e2e/website.spec.ts` (14)

1. Opens as a website: navbar links, hero call to action, moving packets, no stage or toolbar, page
   taller than 4000 px; no console errors.
2. Navigation links scroll to their sections and mark the current one.
3. Simulation runs, pauses (counter frozen), resumes at 4× (≥ 6 probes in 2.5 s), resets, and pauses
   itself when scrolled off-screen.
4. Missing data loses measurements on first view and toggles Complete/Incomplete.
5. Dataset table (48 rows), 4 rejected rows, CSV duplicate rejected with line number, sample CSV flows
   to reconstruction ("2 of 2") and evaluation (holdout); no errors.
6. Methods: construction finishes with an estimate marker; Newton equals Lagrange; spline; Replay.
7. Reconstruction animates ("Estimating …") to "9 of 9" with 9 amber markers; Original hides them.
8. Evaluation cards, best-method badge, bar chart, interpretation.
9. Chart tooltip on hover.
10. Reduced motion: simulation paused, constructions finished immediately.
11–14. 1920, 1366, 1024 and 390 px: no horizontal overflow after visiting every section, no errors;
    mobile menu navigation at 390 px; full-page screenshot attached for each width.

## Performance

Measured in Chromium at 1920 × 1080 by counting animation frames for two seconds per section: about
60 fps in the hero, simulation, methods, reconstruction and evaluation sections, longest frame
17–33 ms. Frame loops run only while their section is visible (verified: the simulation reports
"Paused while off-screen"). Not measured on the presenter's RTX 3050 laptop.

Playwright runs with 3 workers: with 8 parallel browsers each running live animations, this laptop's
CPU was saturated and timing-based tests timed out. Single-worker runs of the same tests passed.

## Visual QA

Every section was screenshotted at 1920, 1366, 1024 and 390 px and reviewed. Fixed: charts widening
their single-column container on mobile (384 px overflow), empty space under stretched cards, chart
legend overlapping axis labels, a "0.0" axis tick, an uncomputed claim in the key findings (replaced
by the measured largest error), truncated method tabs on phones.

## Known gaps

* E2E runs in Chromium only.
* No measurement on the target laptop or projector hardware.
