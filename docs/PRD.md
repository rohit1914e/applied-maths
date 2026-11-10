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
| Student (presenter) | Walks an audience through the page, runs live experiments |
| Examiner or visitor | Reads and explores; can change data, method, missing point and node count |

## 3. Experience requirements

* A responsive, modern website (not a slideshow or presentation player): sticky navigation, a hero
  with a live network, and one scrollable page of sections. Full viewport width, content up to
  about 1400 px, readable from 390 px to 1920 px with no horizontal overflow.
* Alive but purposeful: packets travel, the series is drawn, measurements disappear, curves are
  constructed, gaps are filled, bars grow. Animations start when their section is seen and stop
  when it scrolls away. Reduced-motion settings are respected.
* Users stay in control: normal scrolling, plus controls on every interactive visual.

| Section | Content |
| --- | --- |
| Navigation | Logo and name; Overview, Network Simulation, Dataset, Methods, Reconstruction, Evaluation; mobile menu |
| Hero | Title, subtitle, explanation, live topology with metrics, "Explore the simulation" |
| Network simulation | Topology, packets, live RTT/average/jitter/timeouts, live chart, pause/resume/reset, speed, loss rate |
| Missing data | Series with measurements removed, complete/incomplete toggle, why it matters |
| Dataset | Table with status, CSV upload, validation and preprocessing results, rejected rows |
| Methods | Lagrange, Newton, spline panels: equation, explanation, calculations, graph, animated construction, estimate |
| Reconstruction | Animated estimation of every gap, original vs reconstructed, steps per estimate |
| Evaluation | MAE, RMSE, max error per method, best highlighted, charts, explanations |
| Conclusion | Summary, findings, limitations, technologies, credits |

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
6. **Interaction** — navigation with scrollspy, simulation controls, data controls, method and
   point selection, replay buttons, comparison toggles, chart tooltips.

## 5. Non-functional requirements

* Works offline; no backend, accounts or API keys. Fonts are bundled.
* Responsive at 1920, 1366, 1024 and 390 px without horizontal overflow.
* No idle render loops; frame loops only while their section is visible and not paused; GSAP contexts reverted on unmount.
* Keyboard accessible, visible focus, sufficient contrast, reduced-motion respected.

## 6. Out of scope

Live ICMP collection (would need a local privileged backend), forecasting future values,
multi-host aggregation, cloud deployment.

## 7. Acceptance

All website sections implemented and reachable from the navigation; three algorithms correct under unit tests;
dataset generation and CSV import working; reconstruction and metrics driven by live
algorithm output; ground truth isolated; lint, type-check, unit/component tests, Playwright
and production build all passing; documentation complete.
