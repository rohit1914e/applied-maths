# User Guide

## Setup

Requires Node.js 20 or newer.

```bash
cd "numerical maths"
npm install
npm run dev          # http://localhost:5173 — for rehearsal
```

For the presentation itself use the production build (faster, no dev overlay):

```bash
npm run build
npm run preview      # http://localhost:4173
```

The app needs no internet connection once installed. Before presenting, add your names in
`src/config/credits.ts` (empty fields are simply not shown) and rebuild.

## Controls

| Action | Keyboard | Control bar |
| --- | --- | --- |
| Next build, then next chapter | Space | build button (shows `1/3 Next item`) |
| Next / previous chapter | → / ← (clicker: PageDown / PageUp) | ‹ › |
| Jump to chapter | 1–8 | chapter menu |
| Fullscreen | F; Esc to exit | Fullscreen |
| Presenter notes | N | Notes |
| Pause / resume animation | P | Pause |
| Replay current chapter | R | Replay |
| Restart presentation | Home | Restart |

Nothing ever advances by itself. After clicking a button with the mouse, Space goes back to
meaning "advance". Keys typed into form fields are not treated as shortcuts.

## Presenting with a projector

1. Extend (not mirror) the display. Open the app on the projector screen.
2. Press **N**, then **Open in window**. Drag the notes window to your laptop screen.
3. Click the stage window and press **F**. Only the stage is projected.
4. Use the clicker or arrow keys. Keys pressed in the notes window also control the stage.

The control bar hides itself in fullscreen and reappears when you move the mouse.

## Chapters

1. **Understanding Network Latency** — Space reveals four short definitions. *Start presentation* moves on.
2. **The Journey of a Network Packet** — *Send ping* animates one probe and fills the hop table.
   *Send ping that times out* shows a probe with no recorded value.
3. **When Measurements Disappear** — builds: values appear, gaps are marked with causes, reasons to reconstruct.
4. **Preparing the Measurements** — set samples, range, seeds, missing share and pattern, then
   *Generate dataset*. Or *Import CSV* (`timestamp,ping_ms`), or *Load sample CSV*.
5. **The Mathematics Behind Reconstruction** — choose a tab; Space builds construction,
   substitution and estimate for the chapter 3 example.
6. **Reconstructing Missing Measurements** — choose method, node count (polynomials) and record
   (arrows or click a crimson marker); *Reconstruct* draws the curve and shows the steps.
   *Reconstruct all* fills every gap; *Clear* removes estimates.
7. **How Accurate Is Our Reconstruction?** — builds: per-point table, metrics and chart,
   interpretation. For CSV data a *Hold out* selector chooses the share of known rows to hide.
8. **From Missing Data to Reconstructed Measurements** — the completed series, then summary,
   limitations and applications, credits.

Chapters 6–8 always use the dataset currently active in chapter 4.

## Testing

```bash
npm run lint        # oxlint
npm run typecheck   # tsc -b
npm test            # Vitest unit + component tests
npm run test:e2e    # production build + Playwright (first time: npx playwright install chromium)
npm run check       # all of the above
```

The Playwright HTML report (with a screenshot of each chapter) is written to `playwright-report/`.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Fullscreen does nothing | Some browsers block it inside iframes or without a click; click the stage first, then press F. |
| Notes window does not open | Allow pop-ups for localhost. The in-page drawer still works. |
| CSV rejected | Read the listed line numbers; the previous dataset stays active until the file is valid. |
| Animations feel slow | Press P to pause/resume, or enable "reduce motion" in the OS to skip animations. |
