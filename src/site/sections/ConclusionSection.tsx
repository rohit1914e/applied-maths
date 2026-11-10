import { useMemo } from 'react'
import { useDataset } from '../../state/DatasetContext'
import { reconstruct } from '../../reconstruction/reconstruct'
import { METHOD_SHORT_LABELS } from '../../types/interpolation'
import { CREDITS } from '../../config/credits'
import { fmt, fmtSeconds } from '../../utils/format'
import { LogoMark } from '../Navbar'
import { Section } from '../Section'

const TECH = ['React 19 and TypeScript', 'Vite and Tailwind CSS', 'GSAP and ScrollTrigger', 'SVG visualisations', 'KaTeX equations', 'PapaParse CSV parsing', 'Vitest and Playwright']

export function ConclusionSection() {
  const { bundle, experiment, method, nodeCount } = useDataset()
  const outcomes = useMemo(() => reconstruct(bundle.observed, bundle.missingIndices, { method, nodeCount }), [bundle, method, nodeCount])
  const filled = outcomes.filter((o) => o.ok).length
  const best = experiment?.tiedBest.map((m) => METHOD_SHORT_LABELS[m]).join(' and ')
  const bestMetrics = experiment?.results.find((r) => r.method === experiment.bestByRmse)?.metrics
  const spline = experiment?.results.find((r) => r.method === 'spline')?.metrics
  const lagrange = experiment?.results.find((r) => r.method === 'lagrange')?.metrics
  const bestRows = experiment?.results.find((r) => r.method === experiment.bestByRmse)
  const worstRow = bestRows?.rows.reduce<(typeof bestRows.rows)[number] | null>((w, r) => (r.absError !== null && (!w || r.absError > (w.absError ?? 0)) ? r : w), null)
  const worst = bestRows && worstRow ? { method: bestRows.method, error: worstRow.absError!, t: worstRow.timestamp } : null

  return (
    <Section
      id="conclusion"
      title="Conclusion"
      intro="Missing ping records can be reconstructed responsibly: from measured neighbours only, with every step visible, marked as estimates, and checked against values we were able to hide."
    >
      <div className="grid grid-cols-1 [&>*]:min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <div className="card p-5" data-reveal>
          <h3 className="font-semibold">Summary</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {bundle.source.type === 'synthetic' ? 'A seeded synthetic' : 'The imported'} latency series with {bundle.missingIndices.length} missing records was validated, then every interior gap was estimated with Lagrange, Newton divided differences and a natural cubic spline. {filled} of {outcomes.length} gaps are currently filled with {METHOD_SHORT_LABELS[method]}.
          </p>
        </div>
        <div className="card p-5" data-reveal data-testid="key-findings">
          <h3 className="font-semibold">Key findings</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-muted marker:text-accent">
            {bestMetrics && best && (
              <li>
                Lowest RMSE: {best}, {fmt(bestMetrics.rmse, 3)} ms.
              </li>
            )}
            {spline && lagrange && <li>Spline RMSE {fmt(spline.rmse, 3)} ms against {fmt(lagrange.rmse, 3)} ms for the local cubic polynomial.</li>}
            <li>Lagrange and Newton give identical estimates: the same polynomial in two forms.</li>
            {worst && (
              <li>
                Largest single error ({METHOD_SHORT_LABELS[worst.method]}): {fmt(worst.error, 2)} ms at t = {fmtSeconds(worst.t)} s.
              </li>
            )}
          </ul>
        </div>
        <div className="card p-5" data-reveal>
          <h3 className="font-semibold">Limitations</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-muted marker:text-missing-ink">
            <li>Assumes the hidden value follows its neighbours; a spike behind a timeout is invisible.</li>
            <li>No extrapolation: gaps at the start or end stay empty.</li>
            <li>High-degree polynomials oscillate, so the window is capped at 10 nodes.</li>
            <li>Accuracy is measured on hidden known values, not on truly unknown ones.</li>
          </ul>
        </div>
        <div className="card p-5" data-reveal>
          <h3 className="font-semibold">Technologies</h3>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {TECH.map((t) => (
              <li key={t} className="badge border border-line bg-canvas font-medium text-ink">
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  )
}

export function Footer() {
  const presenters = CREDITS.presenters.filter(Boolean)
  return (
    <footer className="border-t border-line bg-surface">
      <div className="wrap flex flex-wrap items-start justify-between gap-6 py-10" data-testid="credits">
        <div className="flex items-center gap-3">
          <LogoMark size={32} />
          <div>
            <p className="heading text-base leading-tight">Network Latency Predictor</p>
            <p className="text-sm text-muted">Recovering missing network measurements through numerical interpolation</p>
          </div>
        </div>
        <dl className="grid grid-cols-1 [&>*]:min-w-0 grid-cols-[auto_1fr] gap-x-5 gap-y-1 text-sm">
          {presenters.length > 0 && (
            <>
              <dt className="text-muted">Built by</dt>
              <dd>{presenters.join(', ')}</dd>
            </>
          )}
          {CREDITS.supervisor && (
            <>
              <dt className="text-muted">Supervisor</dt>
              <dd>{CREDITS.supervisor}</dd>
            </>
          )}
          <dt className="text-muted">Course</dt>
          <dd>
            {CREDITS.course} capstone{CREDITS.institution ? `, ${CREDITS.institution}` : ''}, {CREDITS.year}
          </dd>
          <dt className="text-muted">Data</dt>
          <dd>Seeded synthetic series or your own CSV; packet traffic is simulated</dd>
        </dl>
      </div>
    </footer>
  )
}
