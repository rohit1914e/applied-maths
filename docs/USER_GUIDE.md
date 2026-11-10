# User Guide

## Setup

Requires Node.js 20 or newer.

```bash
cd "numerical maths"
npm install
npm run dev          # http://localhost:5173 — rehearsal, reloads on save
```

For the presentation itself use the production build:

```bash
npm run build
npm run preview      # http://localhost:4173
```

Everything works offline once installed. Before presenting, add your names in
`src/config/credits.ts` (empty fields are not shown) and rebuild.

## How the experience works

The application is one continuous story in seven scenes. Scrolling moves through it; each
scene's animation is tied to the scroll position, so scrolling back plays it in reverse. Scenes
cross-fade into each other. Nothing advances on a timer: if you stop, the story stops. The
opening network simulation keeps running while you talk (pause it with **P**).

| Action | Keyboard | Mouse / control bar |
| --- | --- | --- |
| Next step (plays the next construction at a readable pace) | Space, ↓, PageDown | ⌄ button (shows the next step's name) |
| Previous step | Shift+Space, ↑, PageUp | ⌃ button |
| Next / previous scene | → / ← | scene list |
| Jump to scene | 1–7 | scene list, or click the story rail |
| Scroll freely | — | mouse wheel or touchpad over the stage |
| Pause / resume all animation | P | Pause |
| Animation speed (0.5×–2×) | + / − | speed selector |
| Reduced motion | M | Reduce motion |
| Replay the current scene | R | Replay |
| Restart from scene 1 | Home | Restart |
| Presenter notes | N | Presenter |
| Fullscreen | F (Esc to exit) | Fullscreen |

Pausing also freezes a step that is in progress, so you can stop exactly on a formula and
explain it. A clicker sends PageDown/PageUp, which step through the story.

## Presenting with a projector

1. Extend (not mirror) the display and open the app on the projector screen.
2. Press **N**, then **Open in window**, and drag the notes window to your laptop.
3. Click the stage and press **F**. Only the stage is projected; the control bar hides until
   the mouse moves.
4. Use the clicker, the keyboard, or scroll. Keys pressed in the notes window also drive the
   story.

## The seven scenes

1. **Understanding Network Latency** — a live simulation: probes travel client → router → server
   and back every second, round-trip times update the readouts and the trace, and about 6 % of
   replies are lost (crimson gaps). Steps: where the time goes (hop delays), replies that never arrive.
2. **When Measurements Disappear** — the dataset's time series builds point by point, then the
   masked measurements fall away leaving crimson slots. Live facts: coverage, broken steps,
   recorded vs. true mean. Causes of missing records.
3. **Preparing the Measurements** — raw records (out of order, with four injected faults) pass
   through validation, sorting and missing-value identification, then become the clean dataset.
   **Change dataset** opens the generator and CSV import.
4. **The Mathematics of Reconstruction** — zooms into one gap. Lagrange basis polynomials, the
   Newton divided-difference table and growing partial polynomials, and spline segments are built
   as you scroll, with the real equations and numbers. Tabs jump between methods; Compare shows
   all three estimates.
5. **Reconstructing Missing Measurements** — every gap is estimated in turn; amber diamonds appear
   on the series. Change method or node count at any time; click a gap or a log entry to see its
   intermediate values.
6. **How Accurate Is Our Reconstruction?** — hidden true values are compared with the estimates
   one by one while MAE, RMSE and maximum error accumulate; then all three methods side by side.
7. **From Missing Data to Reconstructed Measurements** — the completed series, summary,
   limitations and applications, credits.

## Data

Scene 3's **Change dataset** panel offers:

* Synthetic data: samples, latency range, generator seed, missing share, random or consecutive
  gaps, mask seed, irregular probe times. **Generate dataset** applies it everywhere.
* CSV import: header `timestamp,ping_ms`; empty, `NA` or `timeout` cells mean missing. Invalid
  files are rejected with line numbers and the previous dataset stays active. **Load sample CSV**
  loads a 10-row example.

## Testing

```bash
npm run lint        # oxlint
npm run typecheck   # tsc -b
npm test            # Vitest unit + component tests
npm run test:e2e    # production build + Playwright (first time: npx playwright install chromium)
npm run check       # all of the above
```

The Playwright HTML report (`playwright-report/`) contains screenshots of every scene at
1920 × 1080 and 1366 × 768.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Space does nothing after clicking a form field | Click the stage background; keys typed into fields are not shortcuts. |
| Fullscreen does nothing | Click the stage first, then press F; some browsers block fullscreen without a click. |
| Notes window does not open | Allow pop-ups for localhost; the in-page drawer still works. |
| CSV rejected | Read the listed line numbers; fix them and import again. |
