import { useMemo } from 'react'
import type { ChapterProps } from '../../types/presentation'
import { ChapterFrame, Reveal } from '../../components/presentation/ChapterFrame'
import { LatencyPlot } from '../../components/graphs/LatencyPlot'
import { toPlotData } from '../../components/graphs/plotData'
import { useDataset } from '../../state/DatasetContext'
import { mergeReconstructions, reconstruct } from '../../reconstruction/reconstruct'
import { METHOD_SHORT_LABELS } from '../../types/interpolation'
import { CREDITS } from '../../config/credits'
import { rankByRmse } from '../../evaluation/comparison/compareMethods'
import { fmt } from '../../utils/format'

export default function Conclusion({ step }: ChapterProps) {
  const { bundle, reconstructions, experiment, nodeCount } = useDataset()

  // Use the chapter 6 reconstructions when they cover every gap; otherwise fill the gaps
  // with the method that scored the lowest RMSE in chapter 7 (spline if none did).
  const { merged, methodNote, filled } = useMemo(() => {
    const complete = bundle.missingIndices.every((i) => reconstructions.has(i))
    if (complete && reconstructions.size > 0) {
      const methods = new Set([...reconstructions.values()].map((o) => o.method))
      return {
        merged: mergeReconstructions(bundle.observed, reconstructions),
        methodNote: `reconstructed in chapter 6 with ${[...methods].map((m) => METHOD_SHORT_LABELS[m]).join(' and ')}`,
        filled: reconstructions.size,
      }
    }
    const method = experiment?.bestByRmse ?? 'spline'
    const outcomes = reconstruct(bundle.observed, bundle.missingIndices, { method, nodeCount })
    const map = new Map(outcomes.map((o) => [o.index, o]))
    return {
      merged: mergeReconstructions(bundle.observed, map),
      methodNote: `reconstructed with ${METHOD_SHORT_LABELS[method]}${experiment?.bestByRmse ? ', the lowest-RMSE method in chapter 7' : ''}`,
      filled: outcomes.filter((o) => o.ok).length,
    }
  }, [bundle, reconstructions, experiment, nodeCount])

  const ranked = experiment ? rankByRmse(experiment.results) : []
  const presenters = CREDITS.presenters.filter(Boolean)

  return (
    <ChapterFrame number={8} title="From Missing Data to Reconstructed Measurements">
      <div className="flex h-full flex-col">
        <div className="shrink-0">
          <LatencyPlot width={1712} height={300} data={toPlotData(merged)} label="The dataset with every gap reconstructed" connectReconstructed />
          <p className="mt-1 text-[19px] text-muted">
            {bundle.observed.measurements.length - bundle.missingIndices.length} measured values in brown, {filled} amber estimates {methodNote}.
          </p>
        </div>

        <div className="relative mt-6 min-h-0 flex-1">
          {step === 0 && (
            <p className="lede max-w-[1100px] text-charcoal">
              Every gap in the series now carries an estimate, computed from its measured neighbours and marked as reconstructed, never as measured.
            </p>
          )}

          {step === 1 && (
            <Reveal visible className="grid grid-cols-3 gap-x-[64px]">
              <Column heading="The problem">
                Latency monitors lose records to failed probes, late replies and collector errors. The gaps bias statistics and break tools that expect one value per interval.
              </Column>
              <Column heading="The methods">
                Lagrange and Newton divided differences on a local window of {nodeCount} nodes, the same polynomial in two forms, and a natural cubic spline through every observed point.
              </Column>
              <div>
                <h2 className="section-heading">The evidence</h2>
                {ranked.length > 0 ? (
                  <>
                    <p className="small-copy mt-2 text-muted">RMSE on {ranked[0].metrics!.n} hidden known values:</p>
                    <ul className="num mt-1 space-y-1 text-[24px]" data-testid="conclusion-metrics">
                      {ranked.map((r) => (
                        <li key={r.method} className="flex justify-between border-b border-rule pb-1">
                          <span className="font-sans">{METHOD_SHORT_LABELS[r.method]}</span>
                          <span>{fmt(r.metrics!.rmse, 3)} ms</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="small-copy mt-2 text-muted">No hidden known values were available to score.</p>
                )}
              </div>
            </Reveal>
          )}

          {step === 2 && (
            <Reveal visible className="grid grid-cols-2 gap-x-[96px]">
              <div>
                <h2 className="section-heading">Limitations</h2>
                <ul className="body-copy mt-2 list-disc space-y-1.5 pl-7 marker:text-crimson">
                  <li>Assumes the hidden value follows its neighbours; a spike behind a timeout is invisible.</li>
                  <li>No extrapolation: gaps at the start or end of a series stay empty.</li>
                  <li>High-degree polynomials oscillate, so the degree is capped at 9.</li>
                  <li>Accuracy is measured on masked known values, not on truly unknown ones.</li>
                </ul>
              </div>
              <div>
                <h2 className="section-heading">Where it applies</h2>
                <ul className="body-copy mt-2 list-disc space-y-1.5 pl-7 marker:text-amber">
                  <li>Network monitoring dashboards and latency reports.</li>
                  <li>Resampling uneven measurements onto a regular time grid.</li>
                  <li>Any smooth telemetry series: sensors, energy, environment.</li>
                  <li>Teaching: every step of the arithmetic is visible.</li>
                </ul>
              </div>
            </Reveal>
          )}

          {step >= 3 && (
            <Reveal visible className="flex h-full flex-col items-start justify-center">
              <p className="display-title text-[64px] text-charcoal">Network Latency Predictor</p>
              <p className="mt-2 font-serif text-[30px] text-brown italic">Interpolating missing ping measurements</p>
              <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-8 gap-y-1.5 text-[22px]" data-testid="credits">
                {presenters.length > 0 && (
                  <>
                    <dt className="text-muted">Presented by</dt>
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
                <dt className="text-muted">Built with</dt>
                <dd>React, TypeScript, GSAP, Recharts, KaTeX and PapaParse</dd>
              </dl>
              <p className="mt-8 font-serif text-[34px] text-crimson italic">Thank you.</p>
            </Reveal>
          )}
        </div>
      </div>
    </ChapterFrame>
  )
}

function Column({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="section-heading">{heading}</h2>
      <p className="body-copy mt-2 text-muted">{children}</p>
    </div>
  )
}
