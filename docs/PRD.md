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

* An interactive scientific documentary, not a slideshow: the first screen is a living network
  simulation, and the story continues as one connected scroll through seven scenes.
* The presenter stays in control: mouse wheel, keyboard (Space, arrows, clicker keys, 1–7) and
  on-screen controls. Nothing advances on a timer.
* Motion explains something: packets travelling, values disappearing, records flowing through
  validation, curves being constructed, estimates landing, errors accumulating.
* Pause/resume, speed (0.5×–2×), reduced motion, replay scene, restart, presenter mode with notes
  that never reach the projected stage.
* No animation loops while paused or off-screen.

| # | Scene | What moves |
| - | --- | --- |
| 1 | Understanding Network Latency | Live probes client → router → server, RTT readouts, live trace, timeouts |
| 2 | When Measurements Disappear | Series builds, masked values fall away, gaps appear; live facts on the impact |
| 3 | Preparing the Measurements | Raw records flow through validation, sorting, missing identification; dataset settings |
| 4 | The Mathematics of Reconstruction | Lagrange basis, Newton partial polynomials, spline segments built on a real gap, with equations |
| 5 | Reconstructing Missing Measurements | Every gap estimated in turn; amber estimates vs brown measurements |
| 6 | How Accurate Is Our Reconstruction? | Truth vs estimate with error bars; running MAE/RMSE/max; method comparison |
| 7 | From Missing Data to Reconstructed Measurements | Completed series, summary, limitations, credits |

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
6. **Experience controller** — step forward/back, scene list, story rail, fullscreen, replay,
   pause/resume, speed, reduced motion, presenter notes, restart, wheel and keyboard.

## 5. Non-functional requirements

* Works offline; no backend, accounts or API keys. Fonts are bundled.
* Readable at 1920 × 1080 on a projector (body text ≥ 22 px on the design canvas).
* No idle render loops; frame loops only while a scene is on screen and not paused; GSAP contexts reverted when scenes unmount.
* Keyboard accessible, visible focus, sufficient contrast, reduced-motion respected.

## 6. Out of scope

Live ICMP collection (would need a local privileged backend), forecasting future values,
multi-host aggregation, cloud deployment.

## 7. Acceptance

All seven scenes implemented and navigable; three algorithms correct under unit tests;
dataset generation and CSV import working; reconstruction and metrics driven by live
algorithm output; ground truth isolated; lint, type-check, unit/component tests, Playwright
and production build all passing; documentation complete.
