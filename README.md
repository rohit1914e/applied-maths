# Network Latency Predictor

**Recovering missing network measurements through numerical interpolation** — a responsive
website for a Numerical Methods capstone. It opens on a live network simulation and continues as
one scrolling page: why ping records go missing, the dataset and its validation, interactive
Lagrange, Newton divided-difference and natural cubic spline panels, animated reconstruction of
every gap, and an accuracy evaluation. Every number comes from the real algorithms.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build && npm run preview   # production build at http://localhost:4173
npm run check      # lint, type-check, unit/component tests, Playwright E2E
```

Add your names in `src/config/credits.ts` to show them in the footer.

## Documentation

| Document | Contents |
| --- | --- |
| [docs/PRD.md](docs/PRD.md) | Requirements |
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Phases and key decisions, including both redesigns |
| [docs/SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md) | Website structure, data isolation, animation |
| [docs/MATHEMATICAL_METHODOLOGY.md](docs/MATHEMATICAL_METHODOLOGY.md) | Derivations and a worked example |
| [docs/ALGORITHM_IMPLEMENTATION.md](docs/ALGORITHM_IMPLEMENTATION.md) | Code-level algorithms and tolerances |
| [docs/DATASET_DOCUMENTATION.md](docs/DATASET_DOCUMENTATION.md) | Generator, masks, preprocessing, CSV format, simulation |
| [docs/TEST_REPORT.md](docs/TEST_REPORT.md) | What is tested and the results |
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | Running and using the site |
| [docs/VIVA_QUESTIONS.md](docs/VIVA_QUESTIONS.md) | Likely questions with answers |

Stack: React 19, TypeScript 7, Vite 8, Tailwind CSS 4, GSAP + ScrollTrigger + @gsap/react, KaTeX,
PapaParse, Vitest, Testing Library, Playwright.
