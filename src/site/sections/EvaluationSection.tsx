import { useMemo, useRef, useState } from 'react'
import { Tex } from '../../components/typography/Tex'
import { linearScale, niceTicks } from '../../components/graphs/scale'
import { useConstruction } from '../../hooks/useConstruction'
import { useElementWidth, useFirstView } from '../../hooks/useViewport'
import { useDataset } from '../../state/DatasetContext'
import type { AccuracyExperiment, MethodEvaluation } from '../../evaluation/comparison/compareMethods'
import { METHOD_LABELS, METHOD_SHORT_LABELS, METHODS, type InterpolationMethod } from '../../types/interpolation'
import { fmt, fmtSeconds } from '../../utils/format'
import { Section } from '../Section'

const COLOURS: Record<InterpolationMethod, string> = { lagrange: '#633f32', newton: '#c18b52', spline: '#8e252d' }
const METRICS = [
  { key: 'mae', label: 'MAE', tex: '\\mathrm{MAE} = \\frac{1}{n}\\sum_{i=1}^{n} |y_i - \\hat y_i|', text: 'The average size of an error, in milliseconds. Every miss counts in proportion to its size.' },
  { key: 'rmse', label: 'RMSE', tex: '\\mathrm{RMSE} = \\sqrt{\\frac{1}{n}\\sum_{i=1}^{n} (y_i - \\hat y_i)^2}', text: 'Squares errors before averaging, so large misses weigh more. Always at least the MAE; a big gap means a few large errors.' },
  { key: 'maxAbsError', label: 'Max |error|', tex: '\\max_i\\, |y_i - \\hat y_i|', text: 'The single worst estimate. It shows how wrong one reconstructed value can be.' },
] as const

export function EvaluationSection() {
  const { bundle, experiment, experimentError, holdout, setHoldout } = useDataset()
  const synthetic = bundle.source.type === 'synthetic'

  return (
    <Section
      id="evaluation"
      title="How accurate are the estimates?"
      intro="A truly missing value cannot be checked, so we hide values we do know, reconstruct them from the rest, and compare. Every number below is recomputed from the algorithms whenever the data or settings change."
      aside={
        !synthetic && (
          <label className="flex items-center gap-2 text-sm">
            <span className="field-label">Hold out</span>
            <select className="field-input w-auto py-1.5" value={holdout.percent} onChange={(e) => setHoldout({ ...holdout, percent: Number(e.target.value) })} aria-label="Share of known rows held out">
              {[10, 20, 30, 40].map((v) => (
                <option key={v} value={v}>
                  {v} % of known rows
                </option>
              ))}
            </select>
          </label>
        )
      }
    >
      {!experiment ? (
        <p className="card p-5 text-crimson" role="alert">
          {experimentError}
        </p>
      ) : (
        <Results experiment={experiment} synthetic={synthetic} />
      )}
    </Section>
  )
}

function Results({ experiment, synthetic }: { experiment: AccuracyExperiment; synthetic: boolean }) {
  const best = new Set(experiment.tiedBest)
  const bars = useRef<HTMLDivElement>(null)
  const grow = useConstruction('bars', 1.2)
  useFirstView(bars, grow.play)
  const [shown, setShown] = useState<InterpolationMethod>(experiment.bestByRmse ?? 'spline')
  const result = experiment.results.find((r) => r.method === shown)!
  const bestNames = experiment.tiedBest.map((m) => METHOD_SHORT_LABELS[m]).join(' and ')
  const bestMetrics = experiment.results.find((r) => r.method === experiment.bestByRmse)?.metrics

  return (
    <>
      <p className="text-sm text-muted" data-reveal>
        {synthetic
          ? `The ${experiment.hiddenPositions.length} hidden values are the records masked in the dataset; their true values were kept aside.`
          : `Rows that were empty in the file have no truth, so ${experiment.hiddenPositions.length} known interior rows are held out instead.`}
      </p>

      <div className="mt-4 grid grid-cols-1 [&>*]:min-w-0 gap-4 md:grid-cols-3" data-reveal data-testid="method-metrics">
        {experiment.results.map((r) => (
          <div key={r.method} className={`card p-4 ${best.has(r.method) ? 'border-amber ring-1 ring-amber' : ''}`} data-testid={`metrics-${r.method}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-semibold">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLOURS[r.method] }} />
                {METHOD_LABELS[r.method]}
              </p>
              {best.has(r.method) && <span className="badge bg-amber-soft text-amber-ink">Lowest RMSE</span>}
            </div>
            {r.metrics ? (
              <dl className="mt-3 grid grid-cols-3 gap-2">
                {METRICS.map((m) => (
                  <div key={m.key}>
                    <dt className="text-xs text-muted">{m.label}</dt>
                    <dd className="num text-lg">{fmt(r.metrics![m.key], 3)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-3 text-sm text-crimson">No estimates could be made.</p>
            )}
            {r.failures > 0 && <p className="mt-1 text-xs text-crimson">{r.failures} value(s) not interpolable</p>}
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 [&>*]:min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div ref={bars} className="card p-4 sm:p-5" data-reveal>
          <p className="text-sm font-semibold">Error by method (ms)</p>
          <GroupedBars results={experiment.results} grow={grow.s} />
        </div>
        <div className="card p-4 sm:p-5" data-reveal>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">Hidden truth against estimate</p>
            <div className="segmented" role="group" aria-label="Method shown">
              {METHODS.map((m) => (
                <button key={m} type="button" aria-pressed={shown === m} onClick={() => setShown(m)} className="!px-2.5 !py-1 !text-xs">
                  {METHOD_SHORT_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
          <ErrorPlot experiment={experiment} result={result} />
          <p className="mt-1 text-xs text-muted">Ring: true value. Diamond: estimate. Crimson line: the error.</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 [&>*]:min-w-0 gap-4 md:grid-cols-3" data-reveal>
        {METRICS.map((m) => (
          <div key={m.key} className="card p-4">
            <p className="font-semibold">{m.label}</p>
            <div className="text-[15px]">
              <Tex tex={m.tex} display />
            </div>
            <p className="text-sm text-muted">{m.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-xl border-l-4 border-amber bg-white p-4" data-reveal data-testid="interpretation">
        <p>
          On this dataset the lowest RMSE belongs to <strong>{bestNames}</strong>
          {bestMetrics && ` (${fmt(bestMetrics.rmse, 3)} ms over ${bestMetrics.n} values)`}.
          {best.has('lagrange') && best.has('newton') && ' Lagrange and Newton tie because they are the same polynomial written two ways.'}
        </p>
        <p className="mt-1 text-sm text-muted">This measures typical error on values we could check. It does not validate any estimate of a value that was never measured.</p>
      </div>
    </>
  )
}

function GroupedBars({ results, grow }: { results: readonly MethodEvaluation[]; grow: number }) {
  const [box, width] = useElementWidth<HTMLDivElement>(560)
  const H = 280
  const m = { top: 16, right: 8, bottom: 58, left: 40 }
  const max = Math.max(1e-9, ...results.flatMap((r) => (r.metrics ? [r.metrics.maxAbsError] : [])))
  const ticks = niceTicks(0, max * 1.1, 4)
  const top = Math.max(ticks.at(-1)!, max * 1.1)
  const y = linearScale([0, top], [H - m.bottom, m.top])
  const groupW = (width - m.left - m.right) / METRICS.length
  const barW = Math.min(46, (groupW - 24) / results.length)
  return (
    <div ref={box} className="mt-2 w-full">
      <svg width={width} height={H} className="block" role="img" aria-label="MAE, RMSE and maximum error for each method" data-testid="comparison-bars">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke="#ece5d9" />
            <text x={m.left - 6} y={y(t)} dy="0.35em" textAnchor="end" fontSize={11} fill="#5f5751" className="num">
              {fmt(t, Number.isInteger(t) ? 0 : 1)}
            </text>
          </g>
        ))}
        {METRICS.map((metric, gi) => {
          const gx = m.left + gi * groupW + (groupW - barW * results.length) / 2
          return (
            <g key={metric.key}>
              {results.map((r, ri) => {
                const v = r.metrics ? r.metrics[metric.key] : 0
                const h = (y(0) - y(v)) * grow
                return (
                  <g key={r.method}>
                    <rect x={gx + ri * barW + 2} y={y(0) - h} width={barW - 4} height={h} rx={3} fill={COLOURS[r.method]} />
                    <text x={gx + ri * barW + barW / 2} y={y(0) - h - 5} textAnchor="middle" fontSize={10.5} fill="#252525" className="num" opacity={grow}>
                      {fmt(v, 2)}
                    </text>
                  </g>
                )
              })}
              <text x={m.left + gi * groupW + groupW / 2} y={H - m.bottom + 18} textAnchor="middle" fontSize={12} fontWeight={600} fill="#252525">
                {metric.label}
              </text>
            </g>
          )
        })}
        {results.map((r, i) => (
          <g key={r.method} transform={`translate(${m.left + i * 120} ${H - 6})`}>
            <rect width={10} height={10} y={-9} rx={2} fill={COLOURS[r.method]} />
            <text x={15} fontSize={11.5} fill="#5f5751">
              {METHOD_SHORT_LABELS[r.method]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

function ErrorPlot({ experiment, result }: { experiment: AccuracyExperiment; result: MethodEvaluation }) {
  const [box, width] = useElementWidth<HTMLDivElement>(560)
  const H = 260
  const m = { top: 14, right: 10, bottom: 30, left: 42 }
  const { reference } = experiment
  const geo = useMemo(() => {
    const values = [...reference.values, ...result.rows.flatMap((r) => (r.estimate === null ? [] : [r.estimate]))]
    const lo = Math.min(...values)
    const hi = Math.max(...values)
    const pad = (hi - lo) * 0.08 + 1
    const yt = niceTicks(lo - pad, hi + pad, 4)
    return { yTicks: yt, yDom: [Math.min(lo - pad, yt[0]), Math.max(hi + pad, yt.at(-1)!)] as [number, number], xTicks: niceTicks(reference.timestamps[0], reference.timestamps.at(-1)!, 6) }
  }, [reference, result])
  const x = linearScale([reference.timestamps[0], reference.timestamps.at(-1)!], [m.left, width - m.right])
  const y = linearScale(geo.yDom, [H - m.bottom, m.top])
  const hidden = new Set(experiment.hiddenPositions)
  return (
    <div ref={box} className="mt-2 w-full">
      <svg width={width} height={H} className="block" role="img" aria-label="Hidden true values compared with their estimates" data-testid="error-plot">
        {geo.yTicks.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke="#ece5d9" />
            <text x={m.left - 6} y={y(t)} dy="0.35em" textAnchor="end" fontSize={11} fill="#5f5751" className="num">
              {fmt(t, 0)}
            </text>
          </g>
        ))}
        {geo.xTicks.map((t) => (
          <text key={t} x={x(t)} y={H - m.bottom + 18} textAnchor="middle" fontSize={11} fill="#5f5751" className="num">
            {fmtSeconds(t)}
          </text>
        ))}
        {reference.values.map((v, pos) => (hidden.has(pos) ? null : <circle key={pos} cx={x(reference.timestamps[pos])} cy={y(v)} r={2.2} fill="#633f32" opacity={0.45} />))}
        {result.rows.map((r) => (
          <g key={r.sourceIndex} data-testid="error-pair">
            {r.estimate !== null && <line x1={x(r.timestamp)} x2={x(r.timestamp)} y1={y(r.actual)} y2={y(r.estimate)} stroke="#8e252d" strokeWidth={2} />}
            <circle cx={x(r.timestamp)} cy={y(r.actual)} r={5.5} fill="none" stroke="#252525" strokeWidth={1.75} />
            {r.estimate !== null && (
              <rect x={x(r.timestamp) - 4.5} y={y(r.estimate) - 4.5} width={9} height={9} transform={`rotate(45 ${x(r.timestamp)} ${y(r.estimate)})`} fill="#c18b52" stroke="#633f32" strokeWidth={1} />
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}
