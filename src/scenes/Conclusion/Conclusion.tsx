import { useMemo } from 'react'
import { SceneHeader } from '../../components/presentation/SceneHeader'
import { LatencyPlot } from '../../components/graphs/LatencyPlot'
import { toPlotData } from '../../components/graphs/plotData'
import { useScene } from '../../experience/SceneContext'
import { useStoreValue } from '../../experience/store'
import { segment } from '../../experience/timeline'
import { useDataset } from '../../state/DatasetContext'
import { mergeReconstructions, reconstruct } from '../../reconstruction/reconstruct'
import { rankByRmse } from '../../evaluation/comparison/compareMethods'
import { METHOD_SHORT_LABELS } from '../../types/interpolation'
import { CREDITS } from '../../config/credits'
import { fmt } from '../../utils/format'

const FILL = [0.02, 0.24] as const
const SUMMARY_AT = 0.3
const LIMITS_AT = 0.62
const CREDITS_AT = 0.92

export default function Conclusion() {
  const { progress } = useScene()
  const p = useStoreValue(progress)
  const { bundle, experiment, method, nodeCount } = useDataset()

  const outcomes = useMemo(() => reconstruct(bundle.observed, bundle.missingIndices, { method, nodeCount }), [bundle, method, nodeCount])
  const shown = Math.floor(segment(p, ...FILL) * outcomes.length + 1e-9)
  const merged = mergeReconstructions(bundle.observed, new Map(outcomes.slice(0, shown).map((o) => [o.index, o])))
  const ranked = experiment ? rankByRmse(experiment.results) : []
  const filled = outcomes.filter((o) => o.ok).length
  const presenters = CREDITS.presenters.filter(Boolean)
  const step = p < SUMMARY_AT ? 0 : p < LIMITS_AT ? 1 : p < CREDITS_AT ? 2 : 3

  return (
    <div className="absolute inset-0 bg-ivory px-[104px] pt-[56px]">
      <SceneHeader
        number={7}
        title="From Missing Data to Reconstructed Measurements"
        lede={`${bundle.observed.measurements.length - bundle.missingIndices.length} measured values in brown; ${shown < outcomes.length ? `${shown} of ${filled}` : filled} amber estimates from ${METHOD_SHORT_LABELS[method]}.`}
      />
      <div className="mt-5">
        <LatencyPlot width={1712} height={330} data={toPlotData(merged)} connectReconstructed label="The dataset with every gap reconstructed" />
      </div>

      <div className="mt-8">
        {step === 0 && (
          <p className="lede max-w-[1200px] text-charcoal" data-testid="conclusion-intro">
            Every interior gap now carries an estimate, computed from its measured neighbours and always marked as an estimate, never as a measurement.
          </p>
        )}

        {step === 1 && (
          <div className="grid grid-cols-3 gap-x-[64px]" data-testid="conclusion-summary">
            <Column heading="The problem">
              Latency monitors lose records to failed probes, late replies and collector errors. Gaps bias statistics and break tools that expect one value per interval.
            </Column>
            <Column heading="The methods">
              Lagrange and Newton divided differences on a local window of {nodeCount} nodes, the same polynomial in two forms, and a natural cubic spline through every measured point.
            </Column>
            <div>
              <h3 className="section-heading">The evidence</h3>
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
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-2 gap-x-[96px]">
            <div>
              <h3 className="section-heading">Limitations</h3>
              <ul className="body-copy mt-2 list-disc space-y-1.5 pl-7 marker:text-crimson">
                <li>Assumes the hidden value follows its neighbours; a spike behind a timeout is invisible.</li>
                <li>No extrapolation: gaps at the start or end of a series stay empty.</li>
                <li>High-degree polynomials oscillate, so the degree is capped at 9.</li>
                <li>Accuracy is measured on masked known values, not on truly unknown ones.</li>
              </ul>
            </div>
            <div>
              <h3 className="section-heading">Where it applies</h3>
              <ul className="body-copy mt-2 list-disc space-y-1.5 pl-7 marker:text-amber">
                <li>Network monitoring dashboards and latency reports.</li>
                <li>Resampling uneven measurements onto a regular time grid.</li>
                <li>Any smooth telemetry series: sensors, energy, environment.</li>
                <li>Teaching: every step of the arithmetic is visible.</li>
              </ul>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex items-end justify-between" data-testid="credits">
            <div>
              <p className="display-title text-[60px] text-charcoal">Network Latency Predictor</p>
              <p className="mt-1 font-serif text-[30px] text-brown italic">Interpolating missing ping measurements</p>
              <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-8 gap-y-1.5 text-[22px]">
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
                <dd>React, TypeScript, GSAP and ScrollTrigger, KaTeX and PapaParse</dd>
              </dl>
            </div>
            <p className="font-serif text-[40px] text-crimson italic">Thank you.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Column({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="section-heading">{heading}</h3>
      <p className="body-copy mt-2 text-muted">{children}</p>
    </div>
  )
}
