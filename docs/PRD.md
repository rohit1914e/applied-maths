# Product Requirements — Network Latency Predictor

**Subtitle:** Interpolating Missing Ping Measurements
**Domain:** Numerical Methods (university capstone)
**Format:** Interactive cinematic presentation, run locally in a browser

## 1. Problem

Latency monitors record round-trip times (RTT) at regular intervals. Records go missing
because a probe fails, a reply arrives after the timeout, or the collector itself drops a
write. A gap is not the same thing as packet loss: it is simply a timestamp with no recorded
value. Gaps break averages, charts and alerting rules that expect a regular series.

The project shows how three classical interpolation methods reconstruct those gaps, and
measures how accurate the reconstruction is when the true value is known.

## 2. Audience and use

| Who | Need |
| --- | --- |
| Presenter (student) | Controls pacing manually, explains each concept, reads private notes |
| Examiner | Sees a clean 16:9 canvas; can ask for live experiments (change data, method, point) |

## 3. Experience requirements

* Eight full-screen 16:9 chapters, in a fixed conceptual order, each with one visual subject.
* Chapters never advance automatically. Builds inside a chapter advance only on presenter input.
* Animation only where it explains something (packet travel, missing slot highlight,
  curve drawing, reconstructed value reveal). Replay, pause/resume and reduced motion supported.
* Presenter notes are never rendered inside the projected stage or the fullscreen element.

| # | Chapter | Core interaction |
| - | --- | --- |
| 1 | Understanding Network Latency | Start presentation |
| 2 | The Journey of a Network Packet | Send a simulated ping; force a timeout |
| 3 | When Measurements Disappear | Reveal a timeline; highlight gaps; causes |
| 4 | Preparing the Measurements | Generate a seeded dataset or import CSV; validation report |
| 5 | The Mathematics Behind Reconstruction | Step through Lagrange, Newton and spline on a worked example |
| 6 | Reconstructing Missing Measurements | Pick method, gap and degree; run; see steps and curve |
| 7 | How Accurate Is Our Reconstruction? | Mask known values, reconstruct, compute MAE / RMSE / max error |
| 8 | From Missing Data to Reconstructed Measurements | Summary from live results, limitations, credits |

## 4. Functional requirements

1. **Algorithms** — Lagrange, Newton divided differences, natural cubic spline, implemented
   from scratch with visible intermediate values. No hard-coded answers.
2. **Validation** — reject duplicate or non-finite nodes, too few nodes, extrapolation, and
   polynomial degrees above the documented cap.
3. **Data** — deterministic synthetic generator (count, range, seed, irregular sampling),
   missing-data masks (random or consecutive, percentage), CSV import `timestamp,ping_ms`
   with row-level error reporting.
4. **Isolation** — ground truth lives in a separate validation-only structure; the
   reconstruction pipeline only accepts the observed dataset type.
5. **Evaluation** — artificial masking of known values; per-point absolute error; MAE, RMSE,
   maximum absolute error; comparison across methods. No accuracy percentages are invented.
6. **Presentation controller** — next/previous, progress, chapter index, fullscreen, replay,
   pause/resume, notes toggle, restart, keyboard (arrows, Space, PageUp/PageDown, Escape).

## 5. Non-functional requirements

* Works offline; no backend, accounts or API keys. Fonts are bundled.
* Readable at 1920 × 1080 on a projector (body text ≥ 22 px on the design canvas).
* No idle render loops; GSAP timelines cleaned up on chapter change.
* Keyboard accessible, visible focus, sufficient contrast, reduced-motion respected.

## 6. Out of scope

Live ICMP collection (would need a local privileged backend), forecasting future values,
multi-host aggregation, cloud deployment.

## 7. Acceptance

All eight chapters implemented and navigable; three algorithms correct under unit tests;
dataset generation and CSV import working; reconstruction and metrics driven by live
algorithm output; ground truth isolated; lint, type-check, unit/component tests, Playwright
and production build all passing; documentation complete.
