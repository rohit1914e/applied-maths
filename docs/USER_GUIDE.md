# User Guide

## Live site

https://network-latency-predictor-gilt.vercel.app (static hosting on Vercel's free plan).

## Setup

Requires Node.js 20 or newer.

```bash
cd "numerical maths"
npm install
npm run dev          # http://localhost:5173 — development, reloads on save
npm run build && npm run preview   # http://localhost:4173 — production build
```

Everything works offline once installed. Add your names in `src/config/credits.ts` (empty fields
are not shown) and they appear in the footer.

## The website

A single scrolling page with a sticky navigation bar (Overview, Network Simulation, Dataset,
Methods, Reconstruction, Evaluation). Links scroll smoothly to their section and the current
section is highlighted. On narrow screens the links collapse into a **Menu** button.

| Section | What you can do |
| --- | --- |
| **Overview** (hero) | Watch a live client → router → server network with packets in flight, latest RTT, average, jitter, timeouts and a live trace. **Explore the simulation** jumps to the full simulation. |
| **Network simulation** | Large topology and a 60-probe latency trace. **Pause / Resume**, **Reset**, speed 0.5×–4×, and a **Lost replies** slider (0–25 %). Hop-by-hop delays of the latest probe. |
| **When measurements disappear** | The series is drawn, then the masked values fade away. Toggle **Complete / Incomplete**. Three computed facts (coverage, broken rate-of-change steps, shift in the average) and the causes of missing records. |
| **The dataset** | Table of every record with timestamp, ping and status. **Data source**: generate synthetic data (seed, size, range, missing share, random or consecutive gaps, irregular times) or **Import CSV** / **Load sample CSV**. **Validation and preprocessing**: counts per stage and every rejected row with its reason. |
| **Three interpolation methods** | Tabs for Lagrange, Newton divided differences and natural cubic spline. Choose the **Missing point** and the number of **Nodes**; the curve is constructed step by step next to the equation and intermediate values. **Replay construction** runs it again. |
| **Reconstructing the missing values** | Every gap is estimated in turn when the section comes into view. Change method or nodes; toggle **Original / Reconstructed**; click a gap or a table row to see its working. |
| **How accurate are the estimates?** | MAE, RMSE and maximum error for each method, the lowest RMSE highlighted, a grouped bar chart, truth-vs-estimate plot, and what each metric means. For CSV data, choose how many known rows to hold out. |
| **Conclusion** | Summary, computed key findings, limitations, technologies; credits in the footer. |

Hover over the latency charts to read individual values.

## CSV format

```csv
timestamp,ping_ms
0,24.1
1,27.6
2,
3,timeout
4,41.8
```

Timestamps in seconds, increasing. Empty, `NA` or `timeout` cells are missing measurements.
Invalid files are rejected with line numbers and the previous dataset stays active.

## Motion and performance

* Animations pause automatically when their section is scrolled out of view.
* With the operating system's **reduce motion** setting, ambient animation stops (the simulation
  starts paused; **Resume** runs it anyway) and every construction shows its finished state.

## Testing

```bash
npm run lint        # oxlint
npm run typecheck   # tsc -b
npm test            # Vitest unit + component tests
npm run test:e2e    # production build + Playwright (first time: npx playwright install chromium)
npm run check       # all of the above
```

The Playwright HTML report (`playwright-report/`) contains full-page screenshots at 1920, 1366,
1024 and 390 px.
