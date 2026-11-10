# Network Latency Predictor

**Interpolating missing ping measurements** — an interactive, presenter-controlled presentation
for a Numerical Methods capstone. Eight 16:9 chapters explain latency, show why ping records go
missing, and reconstruct them with Lagrange, Newton divided-difference and natural cubic spline
interpolation, with every intermediate value visible and accuracy measured by artificial masking.

```bash
npm install
npm run dev        # rehearse at http://localhost:5173
npm run build && npm run preview   # present at http://localhost:4173
npm run check      # lint, type-check, unit/component tests, Playwright E2E
```

Keys: Space next build, → / ← chapter, 1–8 jump, F fullscreen, N notes, P pause, R replay, Home restart.

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

Stack: React 19, TypeScript 7, Vite 8, Tailwind CSS 4, GSAP + @gsap/react, Recharts, KaTeX,
PapaParse, Vitest, Testing Library, Playwright.
