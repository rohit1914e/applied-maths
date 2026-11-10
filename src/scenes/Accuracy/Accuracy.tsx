import { useMemo, useState } from 'react'
import { SceneHeader } from '../../components/presentation/SceneHeader'
import { Tex } from '../../components/typography/Tex'
import { linearScale, niceTicks } from '../../components/graphs/scale'
import { useScene } from '../../experience/SceneContext'
import { useStoreValue } from '../../experience/store'
import { segment } from '../../experience/timeline'
import { useDataset } from '../../state/DatasetContext'
import { computeErrorMetrics } from '../../evaluation/metrics/metrics'
import { METHOD_SHORT_LABELS, METHODS, type InterpolationMethod } from '../../types/interpolation'
import { fmt, fmtSeconds } from '../../utils/format'

const REVEAL = [0.06, 0.56] as const
const COMPARE = [0.6, 0.76] as const
const INTERPRET_AT = 0.84

const PLOT = { w: 1100, h: 420, m: { top: 22, right: 20, bottom: 50, left: 70 } }
const METHOD_COLOURS: Record<InterpolationMethod, string> = { lagrange: '#633f32', newton: '#c18b52', spline: '#8e252d' }

export default function Accuracy() {
  const { progress } = useScene()
  const p = useStoreValue(progress)
  const { bundle, experiment, experimentError, holdout, setHoldout, method: chosen } = useDataset()
  const [method, setMethod] = useState<InterpolationMethod>(chosen)
  const synthetic = bundle.source.type === 'synthetic'

  const geometry = useMemo(() => {
    if (!experiment) return null
    const { reference } = experiment
    const values = [...reference.values, ...experiment.results.flatMap((r) => r.rows.flatMap((row) => (row.estimate === null ? [] : [row.estimate])))]
    const lo = Math.min(...values)
    const hi = Math.max(...values)
    const pad = (hi - lo) * 0.1 + 1
    const yt = niceTicks(lo - pad, hi + pad, 5)
    return {
      x: linearScale([reference.timestamps[0], reference.timestamps.at(-1)!], [PLOT.m.left, PLOT.w - PLOT.m.right]),
      y: linearScale([Math.min(lo - pad, yt[0]), Math.max(hi + pad, yt.at(-1)!)], [PLOT.h - PLOT.m.bottom, PLOT.m.top]),
      yTicks: yt,
      xTicks: niceTicks(reference.timestamps[0], reference.timestamps.at(-1)!, 8),
      hidden: new Set(experiment.hiddenPositions),
    }
  }, [experiment])

  if (!experiment || !geometry) {
    return (
      <div className="absolute inset-0 bg-ivory px-[104px] pt-[56px]">
        <SceneHeader number={6} title="How Accurate Is Our Reconstruction?" />
        <p className="body-copy mt-10 max-w-[1000px] text-crimson" role="alert">
          {experimentError}
        </p>
      </div>
    )
  }

  const { reference } = experiment
  const result = experiment.results.find((r) => r.method === method)!
  const rows = result.rows
  const q = segment(p, ...REVEAL) * rows.length
  const k = Math.min(rows.length, Math.floor(q + 1e-9))
  const grow = q - k
  const revealed = rows.slice(0, k)
  const pairs = revealed.flatMap((r) => (r.estimate === null ? [] : [{ actual: r.actual, estimate: r.estimate }]))
  const running = pairs.length ? computeErrorMetrics(pairs) : null
  const absSum = pairs.reduce((s, pr) => s + Math.abs(pr.actual - pr.estimate), 0)
  const sqSum = pairs.reduce((s, pr) => s + (pr.actual - pr.estimate) ** 2, 0)
  const { x, y } = geometry
  const baseline = PLOT.h - PLOT.m.bottom
  const compare = segment(p, ...COMPARE)
  const best = experiment.tiedBest.map((m) => METHOD_SHORT_LABELS[m]).join(' and ')
  const bestMetrics = experiment.bestByRmse ? experiment.results.find((r) => r.method === experiment.bestByRmse)!.metrics : null

  const lede = synthetic
    ? `We hid ${experiment.hiddenPositions.length} values we know (the masked records), reconstructed them from the rest, and now compare.`
    : `Empty rows have no truth, so ${experiment.hiddenPositions.length} known rows are held out, reconstructed from the rest, and compared.`

  return (
    <div className="absolute inset-0 bg-ivory px-[104px] pt-[56px]">
      <SceneHeader number={6} title="How Accurate Is Our Reconstruction?" lede={lede} />

      <div className="mt-5 grid grid-cols-[1100px_1fr] gap-x-[52px]">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="segmented" role="group" aria-label="Method shown on the plot">
              {METHODS.map((m) => (
                <button key={m} type="button" aria-pressed={method === m} onClick={() => setMethod(m)} className="!py-2 !text-[19px]">
                  {METHOD_SHORT_LABELS[m]}
                </button>
              ))}
            </div>
            {!synthetic && (
              <label className="flex items-center gap-2 text-[18px] text-muted">
                Hold out
                <select className="field-input w-auto py-1 text-[18px]" value={holdout.percent} onChange={(e) => setHoldout({ ...holdout, percent: Number(e.target.value) })}>
                  {[10, 20, 30, 40].map((v) => (
                    <option key={v} value={v}>
                      {v} %
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <svg width={PLOT.w} height={PLOT.h} viewBox={`0 0 ${PLOT.w} ${PLOT.h}`} className="block overflow-visible" role="img" aria-label="Hidden true values compared with their estimates" data-testid="accuracy-plot">
            {geometry.yTicks.map((t) => (
              <g key={t}>
                <line x1={PLOT.m.left} x2={PLOT.w - PLOT.m.right} y1={y(t)} y2={y(t)} stroke="#e4dccf" strokeWidth={1.5} />
                <text x={PLOT.m.left - 12} y={y(t)} dy="0.35em" textAnchor="end" fontSize={18} fill="#5f5751" className="num">
                  {fmt(t, 0)}
                </text>
              </g>
            ))}
            <line x1={PLOT.m.left} x2={PLOT.w - PLOT.m.right} y1={baseline} y2={baseline} stroke="#5f5751" strokeWidth={2} />
            {geometry.xTicks.map((t) => (
              <text key={t} x={x(t)} y={baseline + 28} textAnchor="middle" fontSize={18} fill="#5f5751" className="num">
                {fmtSeconds(t)}
              </text>
            ))}
            {reference.values.map((v, pos) =>
              geometry.hidden.has(pos) ? null : <circle key={pos} cx={x(reference.timestamps[pos])} cy={y(v)} r={3.5} fill="#633f32" opacity={0.55} />,
            )}
            {rows.map((r, i) => {
              const cx = x(r.timestamp)
              if (i > k || (i === k && grow <= 0)) {
                return <circle key={r.sourceIndex} cx={cx} cy={baseline} r={7} fill="#faf8f4" stroke="#8e252d" strokeWidth={3} />
              }
              const g = i < k ? 1 : grow
              const est = r.estimate
              return (
                <g key={r.sourceIndex} data-testid={i < k ? 'error-pair' : undefined}>
                  <circle cx={cx} cy={y(r.actual)} r={9} fill="none" stroke="#252525" strokeWidth={2.5} opacity={Math.min(1, g * 2)} />
                  {est !== null && (
                    <>
                      <line x1={cx} x2={cx} y1={y(r.actual)} y2={y(r.actual) + (y(est) - y(r.actual)) * g} stroke="#8e252d" strokeWidth={3} />
                      <rect x={cx - 7} y={y(est) - 7} width={14} height={14} transform={`rotate(45 ${cx} ${y(est)})`} fill="#c18b52" stroke="#633f32" strokeWidth={1.5} opacity={g} />
                    </>
                  )}
                </g>
              )
            })}
          </svg>
          <p className="mt-1 flex gap-8 text-[18px] text-muted">
            <span>Ring: hidden true value</span>
            <span>Amber: {METHOD_SHORT_LABELS[method]} estimate</span>
            <span>Crimson: the error</span>
          </p>
        </div>

        <div data-testid="running-metrics">
          <p className="text-[20px] text-muted">
            {METHOD_SHORT_LABELS[method]}, {pairs.length} of {rows.length} compared
          </p>
          <dl className="mt-2 grid grid-cols-3 gap-4">
            <Metric label="MAE" value={running?.mae} />
            <Metric label="RMSE" value={running?.rmse} />
            <Metric label="Max |error|" value={running?.maxAbsError} />
          </dl>
          <div className="mt-4 space-y-1 text-[21px]">
            <Tex tex={`\\mathrm{MAE} = \\frac{1}{n}\\sum |y_i - \\hat y_i| ${running ? `= \\frac{${fmt(absSum, 3)}}{${pairs.length}} = ${fmt(running.mae, 3)}` : ''}`} display />
            <Tex tex={`\\mathrm{RMSE} = \\sqrt{\\frac{1}{n}\\sum (y_i - \\hat y_i)^2} ${running ? `= \\sqrt{\\frac{${fmt(sqSum, 3)}}{${pairs.length}}} = ${fmt(running.rmse, 3)}` : ''}`} display />
          </div>
          {revealed.at(-1) && (
            <p className="num mt-2 text-[19px] text-muted" data-testid="latest-error">
              latest: t = {fmtSeconds(revealed.at(-1)!.timestamp)} s, actual {fmt(revealed.at(-1)!.actual, 1)}, estimate {revealed.at(-1)!.estimate === null ? '—' : fmt(revealed.at(-1)!.estimate!, 2)}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-[1100px_1fr] gap-x-[52px]" style={{ visibility: compare > 0 ? 'visible' : 'hidden' }}>
        <ComparisonBars results={experiment.results} grow={compare} />
        <div style={{ opacity: segment(p, INTERPRET_AT - 0.03, INTERPRET_AT) }} data-testid="interpretation">
          <p className="body-copy">
            Lowest RMSE here: <strong>{best}</strong>
            {bestMetrics && `, ${fmt(bestMetrics.rmse, 3)} ms over ${bestMetrics.n} values`}.
            {experiment.tiedBest.includes('lagrange') && experiment.tiedBest.includes('newton') && ' Lagrange and Newton tie because they are the same polynomial.'}
          </p>
          <p className="small-copy mt-2 text-muted">This measures typical error on values we could check. It does not validate any estimate of a value that was never measured.</p>
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="border-t-2 border-rule pt-2">
      <dt className="text-[18px] text-muted">{label}</dt>
      <dd className="num text-[40px] leading-tight text-charcoal">
        {value === undefined ? '—' : fmt(value, 3)}
        <span className="ml-1 text-[18px] text-muted">ms</span>
      </dd>
    </div>
  )
}

function ComparisonBars({ results, grow }: { results: readonly { method: InterpolationMethod; metrics: { mae: number; rmse: number; maxAbsError: number } | null }[]; grow: number }) {
  const metrics = [
    ['mae', 'MAE'],
    ['rmse', 'RMSE'],
    ['maxAbsError', 'Max |error|'],
  ] as const
  const max = Math.max(1e-9, ...results.flatMap((r) => (r.metrics ? [r.metrics.maxAbsError] : [])))
  const W = 1100
  const labelW = 150
  const barMax = W - labelW - 230
  return (
    <svg width={W} height={230} className="block" role="img" aria-label="MAE, RMSE and maximum error for each method" data-testid="comparison-bars">
      {metrics.map(([key, label], gi) =>
        results.map((r, ri) => {
          const v = r.metrics ? r.metrics[key] : 0
          const yy = gi * 76 + ri * 22
          return (
            <g key={`${key}-${r.method}`}>
              {ri === 0 && (
                <text x={0} y={yy + 30} fontSize={19} fill="#252525">
                  {label}
                </text>
              )}
              <rect x={labelW} y={yy + 4} width={(v / max) * barMax * grow} height={17} fill={METHOD_COLOURS[r.method]} />
              <text x={labelW + (v / max) * barMax * grow + 8} y={yy + 18} fontSize={16} fill="#252525" className="num" opacity={grow}>
                {fmt(v, 3)} {METHOD_SHORT_LABELS[r.method]}
              </text>
            </g>
          )
        }),
      )}
    </svg>
  )
}
