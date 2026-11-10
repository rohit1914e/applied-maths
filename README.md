# Network Latency Predictor

**Interpolating missing ping measurements** — an interactive scientific story for a Numerical
Methods capstone. It opens on a live network simulation and scrolls through seven connected
scenes: why ping records go missing, how raw measurements are prepared, how Lagrange, Newton
divided-difference and natural cubic spline interpolation are built, how every gap is
reconstructed, and how accurate the estimates are. Every number comes from the real algorithms.

```bash
npm install
npm run dev        # rehearse at http://localhost:5173
npm run build && npm run preview   # present at http://localhost:4173
npm run check      # lint, type-check, unit/component tests, Playwright E2E
```

Scroll or press Space to move through the story. Keys: Space/↓ next step, ↑ back, → / ← scene, 1–7 jump,
P pause, +/− speed, M reduced motion, R replay scene, Home restart, N presenter notes, F fullscreen.

Before presenting, put your names in `src/config/credits.ts`.

## Documentation

| Document | Contents |
| --- | --- |
| [docs/PRD.md](docs/PRD.md) | Requirements |
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Phases and key decisions |
| [docs/SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md) | Layers, data isolation, controller |
| [docs/MATHEMATICAL_METHODOLOGY.md](docs/MATHEMATICAL_METHODOLOGY.md) | Derivations and the worked example |
| [docs/ALGORITHM_IMPLEMENTATION.md](docs/ALGORITHM_IMPLEMENTATION.md) | Code-level algorithms and tolerances |
| [docs/DATASET_DOCUMENTATION.md](docs/DATASET_DOCUMENTATION.md) | Generator, masks, CSV format |
| [docs/TEST_REPORT.md](docs/TEST_REPORT.md) | What is tested and the results |
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | Running and presenting |
| [docs/VIVA_QUESTIONS.md](docs/VIVA_QUESTIONS.md) | Likely questions with answers |

Stack: React 19, TypeScript 7, Vite 8, Tailwind CSS 4, GSAP + ScrollTrigger + @gsap/react, KaTeX,
PapaParse, Vitest, Testing Library, Playwright.
