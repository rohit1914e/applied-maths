# Test Report

Run on 2026-11-10, Windows 11, Node 24.13.0, Chromium (Playwright 1.65 headless shell 1254).
All results below were produced by actually running the commands; nothing is skipped or
marked `.only`/`.skip`.

| Check | Command | Result |
| --- | --- | --- |
| Lint | `npm run lint` (oxlint) | 0 warnings, 0 errors |
| Type-check | `npm run typecheck` (`tsc -b`, TypeScript 7) | pass |
| Unit + component | `npm test` (Vitest 5, jsdom) | **72 / 72 passed**, 4 files |
| End-to-end | `npm run test:e2e` (build + Playwright) | **12 / 12 passed** |
| Production build | `npm run build` | pass |

## Unit tests — numerical core (`src/algorithms/algorithms.test.ts`, 25)

* Validation: sorted copy without mutation; duplicate and near-duplicate nodes rejected;
  non-finite values and too few nodes rejected.
* Lagrange: exact recovery of a cubic from 4 nodes; reproduces every node; basis sums to 1 and
  satisfies $L_i(x_j)=\delta_{ij}$; factors and terms consistent; hand-worked chapter 3 example
  ($L = -0.2, 0.75, 0.5, -0.05$); extrapolation rejected; degree cap enforced; uneven spacing;
  plotting closure.
* Newton: divided-difference table checked against hand values for $y=x^2$; nested evaluation;
  agreement with Lagrange on identical nodes (values and closures); same validation rules.
* Natural cubic spline: interpolates all nodes; continuity of $S$, $S'$, $S''$ at every interior
  knot; $S''=0$ at both ends; reproduces a straight line exactly; reports interval, $t$ and terms;
  the reported tridiagonal system is satisfied by the solution; two-node linear case;
  extrapolation rejected.
* Node selection: nearest bracketing window; fewer nodes than requested; unbracketable targets.

## Unit tests — data, pipeline, evaluation (`src/data/data.test.ts`, 26)

* Generator: deterministic per seed; respects count and range; irregular timestamps strictly
  increasing and uneven; configuration validation.
* Masks: requested share, endpoints never hidden, deterministic; consecutive bursts of 2–4
  separated by observed records; hidden values only in ground truth (serialised observed data
  contains none of them).
* Isolation: reconstructions unchanged when every ground-truth value is replaced by −999; only
  observed records become nodes.
* Pipeline: every gap reconstructed by every method; Lagrange and Newton identical nodes and
  values; observed rows and extrapolating endpoints refused; merge marks rows `reconstructed`;
  curves stay inside the node span.
* Metrics: MAE, RMSE, max error and its position against hand values; zero error case; empty and
  non-finite sets throw `EvaluationError`.
* Experiment: synthetic hidden set equals the chapter 4 mask and each row's actual equals ground
  truth; Lagrange/Newton reported as a tie; quadratic series recovered to < 1e-9; CSV genuinely
  missing rows excluded and holdout avoids endpoints.
* CSV: sample parsing, every error type with line numbers, endpoint warning, epoch timestamps
  normalised.
* Probe simulator: deterministic, RTT equals hop sum plus processing; timeout records no RTT.

## Component tests (`presentation.test.tsx` 14, `chapters.test.tsx` 7)

* Reducer: builds before chapters, clamping, replay resets build and pause, restart keeps the
  notes preference, no timer-driven transitions.
* Keyboard: arrows, PageUp/PageDown, Space, N/F/P/R, digits; ignored in inputs and with
  modifiers; Space on a focused button presses it; Escape passes through.
* Shell: keyboard navigation; Space reveals builds; Start presentation; notes rendered outside
  the stage and outside the fullscreen root; chapter menu with 8 items; every control present;
  pause/resume.
* Chapters: ping and timeout recorded (chapter 2); form regeneration and validation, CSV upload
  with line-numbered errors and successful import (4); worked estimate equals algorithm output for
  all three tabs and builds hide it at step 0 (5); reconstruction equals the pipeline and shows
  steps, reconstruct-all (6); metrics table equals the live experiment (7); summary and credits (8).

## End-to-end (`e2e/presentation.spec.ts`, 12, 1920 × 1080 unless noted)

1. All eight chapters render with the right titles on a 16:9 stage, **no page or console errors**;
   a screenshot of each chapter is attached to the HTML report.
2. Nothing advances after six idle seconds.
3. Space walks builds then chapters; PageDown/PageUp; digit jump; Home restarts.
4. Fullscreen element is the presentation root; notes are not inside it and are hidden; arrows
   work in fullscreen; notes return after exit; notes never overlap the stage.
5. Notes in a separate window follow chapter changes; keys pressed there drive the stage.
6. Chapter 2 ping produces an RTT; forced timeout records none.
7. Pause freezes the running RTT clock; resume completes the probe.
8. CSV with duplicate timestamp rejected with line number; sample CSV loads; Newton
   reconstruction shows nested evaluation; chapter 7 switches to a holdout and shows metrics;
   no errors.
9. Reduced motion: the probe result appears within 1 s.
10–12. 1366 × 768, 1280 × 800 and 390 × 844: no horizontal page scroll, stage inside the
    viewport, control bar does not overflow.

## Visual QA

Every chapter and build was screenshotted at 1920 × 1080 and reviewed. Defects found and fixed
during review: lede lines wrapping to a single orphan word; "no record" labels wider than their
boxes; long Newton/spline formulas overflowing into the derivation column; spline mode ringing
all 39 knots; chapter 7 naming Newton "best" over Lagrange on a 2.6 × 10⁻¹⁵ ms difference (now a
tie); control bar overflowing below 1600 px; Replay and Restart icons too similar.

## Known gaps

* E2E runs in Chromium only (the target is a presentation laptop; Firefox/WebKit not installed).
* Real projector colour and contrast were not tested on hardware.
