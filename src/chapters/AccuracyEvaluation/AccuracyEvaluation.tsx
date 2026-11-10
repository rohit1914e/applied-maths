import { Bar, BarChart, CartesianGrid, LabelList, Legend, XAxis, YAxis } from 'recharts'
import type { ChapterProps } from '../../types/presentation'
import { ChapterFrame, Reveal } from '../../components/presentation/ChapterFrame'
import { useDataset } from '../../state/DatasetContext'
import { METHOD_SHORT_LABELS, type InterpolationMethod } from '../../types/interpolation'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { fmt, fmtSeconds } from '../../utils/format'

const PROCEDURE = [
  'Start from known values',
  'Keep the truth aside',
  'Hide selected values',
  'Reconstruct from the rest',
  'Compare with the truth',
  'Summarise the errors',
]

const METHOD_COLOURS: Record<InterpolationMethod, string> = {
  lagrange: '#633f32',
  newton: '#c18b52',
  spline: '#8e252d',
}

export default function AccuracyEvaluation({ step }: ChapterProps) {
  const { bundle, experiment, experimentError, holdout, setHoldout, nodeCount } = useDataset()
  const reduced = useReducedMotion()
  const synthetic = bundle.source.type === 'synthetic'

  if (!experiment) {
    return (
      <ChapterFrame number={7} title="How Accurate Is Our Reconstruction?">
        <p className="body-copy max-w-[1000px] text-crimson" role="alert">
          {experimentError}
        </p>
      </ChapterFrame>
    )
  }

  const results = experiment.results
  const byMethod = Object.fromEntries(results.map((r) => [r.method, r])) as Record<InterpolationMethod, (typeof results)[number]>
  const rows = byMethod.lagrange.rows.map((row, i) => ({
    ...row,
    lagrange: byMethod.lagrange.rows[i],
    newton: byMethod.newton.rows[i],
    spline: byMethod.spline.rows[i],
  }))
  const chartData = (['mae', 'rmse', 'maxAbsError'] as const).map((metric) => ({
    metric: metric === 'mae' ? 'MAE' : metric === 'rmse' ? 'RMSE' : 'Max |error|',
    ...Object.fromEntries(results.map((r) => [r.method, r.metrics ? Number(r.metrics[metric].toFixed(3)) : 0])),
  }))
  const best = experiment.bestByRmse
  const bestMetrics = best ? byMethod[best].metrics : null
  const lnDiff = byMethod.lagrange.metrics && byMethod.newton.metrics ? Math.abs(byMethod.lagrange.metrics.rmse - byMethod.newton.metrics.rmse) : null
  const bestNames = experiment.tiedBest.map((m) => METHOD_SHORT_LABELS[m]).join(' and ')

  return (
    <ChapterFrame
      number={7}
      title="How Accurate Is Our Reconstruction?"
      lede={
        synthetic
          ? `We hide values we already know, reconstruct them, and compare. Here: the ${experiment.hiddenPositions.length} records masked in chapter 4.`
          : `Empty rows in ${bundle.source.type === 'csv' ? bundle.source.fileName : 'the file'} have no truth, so we hold out ${experiment.hiddenPositions.length} known rows instead and compare.`
      }
    >
      <div className="flex h-full flex-col">
        <ol className="grid shrink-0 grid-cols-6 gap-x-4 border-b-2 border-rule pb-4" aria-label="Evaluation procedure">
          {PROCEDURE.map((p, i) => (
            <li key={p} className="flex items-baseline gap-3">
              <span className="display-title text-[34px] leading-none text-crimson">{i + 1}</span>
              <span className="text-[20px] leading-snug">{p}</span>
            </li>
          ))}
        </ol>

        <div className="mt-5 grid min-h-0 flex-1 grid-cols-[930px_1fr] gap-x-[52px]">
          <Reveal visible={step >= 1} className="flex min-h-0 flex-col">
            <div className="flex items-baseline justify-between">
              <h2 className="section-heading">Each hidden value, estimated three ways</h2>
              {!synthetic && (
                <label className="flex items-center gap-2 text-[18px] text-muted">
                  Hold out
                  <select
                    className="field-input w-auto py-1 text-[18px]"
                    value={holdout.percent}
                    onChange={(e) => setHoldout({ ...holdout, percent: Number(e.target.value) })}
                  >
                    {[10, 20, 30, 40].map((p) => (
                      <option key={p} value={p}>
                        {p} %
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="mt-2 min-h-0 flex-1 overflow-y-auto" data-testid="error-table">
              <table className="num w-full text-[19px]">
                <thead className="sticky top-0 bg-ivory text-left text-muted">
                  <tr className="border-b-2 border-rule">
                    <th className="py-1 font-sans font-semibold">t (s)</th>
                    <th className="py-1 text-right font-sans font-semibold">Actual</th>
                    {(['lagrange', 'newton', 'spline'] as const).map((m) => (
                      <th key={m} colSpan={2} className="py-1 text-right font-sans font-semibold">
                        {METHOD_SHORT_LABELS[m]} <span className="font-normal">est. / |err|</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.sourceIndex} className="border-b border-rule">
                      <td className="py-1">{fmtSeconds(r.timestamp)}</td>
                      <td className="py-1 text-right font-semibold">{fmt(r.actual, 1)}</td>
                      {(['lagrange', 'newton', 'spline'] as const).map((m) => {
                        const cell = r[m]
                        return cell.estimate === null ? (
                          <td key={m} colSpan={2} className="py-1 text-right text-crimson" title={cell.failure ?? undefined}>
                            not interpolable
                          </td>
                        ) : (
                          [
                            <td key={`${m}e`} className="py-1 text-right">{fmt(cell.estimate, 2)}</td>,
                            <td key={`${m}a`} className="py-1 pl-2 text-right text-muted">{fmt(cell.absError!, 2)}</td>,
                          ]
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[17px] text-muted">
              All values in ms. Lagrange and Newton use {nodeCount} local nodes; the spline uses every observed point.
            </p>
          </Reveal>

          <div className="flex min-h-0 flex-col">
            <Reveal visible={step >= 2}>
              <h2 className="section-heading">Error metrics (ms)</h2>
              <table className="num mt-2 w-full text-[20px]" data-testid="metrics-table">
                <thead className="text-muted">
                  <tr className="border-b-2 border-rule">
                    <th className="py-1 text-left font-sans font-semibold">Method</th>
                    <th className="py-1 text-right font-sans font-semibold">MAE</th>
                    <th className="py-1 text-right font-sans font-semibold">RMSE</th>
                    <th className="py-1 text-right font-sans font-semibold">Max</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.method} className="border-b border-rule" data-testid={`metrics-${r.method}`}>
                      <td className="py-1 font-sans">
                        <span className="mr-2 inline-block h-3 w-3 rounded-sm" style={{ background: METHOD_COLOURS[r.method] }} />
                        {METHOD_SHORT_LABELS[r.method]}
                      </td>
                      <td className="py-1 text-right">{r.metrics ? fmt(r.metrics.mae, 3) : '—'}</td>
                      <td className="py-1 text-right">{r.metrics ? fmt(r.metrics.rmse, 3) : '—'}</td>
                      <td className="py-1 text-right">{r.metrics ? fmt(r.metrics.maxAbsError, 3) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-2" aria-label="Bar chart comparing MAE, RMSE and maximum absolute error by method" role="img">
                <BarChart width={680} height={230} data={chartData} margin={{ top: 22, right: 8, left: 0, bottom: 0 }} barGap={4}>
                  <CartesianGrid vertical={false} stroke="#e4dccf" />
                  <XAxis dataKey="metric" tick={{ fontSize: 18, fill: '#5f5751' }} axisLine={{ stroke: '#5f5751' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 16, fill: '#5f5751' }} axisLine={false} tickLine={false} width={44} />
                  <Legend wrapperStyle={{ fontSize: 17 }} formatter={(v: string) => METHOD_SHORT_LABELS[v as InterpolationMethod]} />
                  {results.map((r) => (
                    <Bar key={r.method} dataKey={r.method} fill={METHOD_COLOURS[r.method]} isAnimationActive={!reduced && step >= 2} animationDuration={700}>
                      <LabelList dataKey={r.method} position="top" fontSize={15} fill="#252525" formatter={(v: unknown) => fmt(Number(v), 2)} />
                    </Bar>
                  ))}
                </BarChart>
              </div>
            </Reveal>
            <Reveal visible={step >= 3} className="mt-2">
              <p className="body-copy" data-testid="interpretation">
                {best && bestMetrics
                  ? `Lowest RMSE on this dataset: ${bestNames}, ${fmt(bestMetrics.rmse, 3)} ms over ${bestMetrics.n} hidden values.`
                  : 'No method produced estimates for the hidden values.'}
                {lnDiff !== null && (lnDiff < 1e-9 ? ' Lagrange and Newton agree to within 10⁻⁹ ms: the same polynomial.' : ` Lagrange and Newton differ by ${fmt(lnDiff, 4)} ms.`)}
              </p>
              <p className="small-copy mt-1 text-muted">
                This measures typical error on values we could check. It does not validate any estimate of a value that was never measured.
              </p>
            </Reveal>
          </div>
        </div>
      </div>
    </ChapterFrame>
  )
}
