import { useMemo, useRef, useState } from 'react'
import { LatencyPlot, type PlotMeasurement } from '../../components/graphs/LatencyPlot'
import { ReconstructionSteps } from '../../components/math/ReconstructionSteps'
import { useConstruction } from '../../hooks/useConstruction'
import { useFirstView } from '../../hooks/useViewport'
import { useDataset } from '../../state/DatasetContext'
import { mergeReconstructions, NODE_COUNT_RANGE, reconstruct, sampleCurve } from '../../reconstruction/reconstruct'
import { METHOD_LABELS, METHOD_SHORT_LABELS, METHODS } from '../../types/interpolation'
import { fmt, fmtSeconds } from '../../utils/format'
import { segment } from '../../utils/progress'
import { Section } from '../Section'

type View = 'original' | 'reconstructed'

export function ReconstructionSection() {
  const { bundle, method, setMethod, nodeCount, setNodeCount } = useDataset()
  const [view, setView] = useState<View>('reconstructed')
  const [inspect, setInspect] = useState<number | null>(null)
  const chart = useRef<HTMLDivElement>(null)

  const outcomes = useMemo(() => reconstruct(bundle.observed, bundle.missingIndices, { method, nodeCount }), [bundle, method, nodeCount])
  const curves = useMemo(() => outcomes.map((o) => sampleCurve(o, 80)), [outcomes])
  const n = outcomes.length
  const sweep = useConstruction(`${method}-${nodeCount}-${bundle.observed.label}`, Math.min(8, Math.max(2.5, n * 0.55)))
  useFirstView(chart, sweep.play)

  const q = sweep.s * n
  const k = Math.min(n, Math.floor(q + 1e-9))
  const f = q - k
  const current = k < n ? outcomes[k] : null
  const landed = Math.min(n, k + (current && f > 0.7 ? 1 : 0))
  const done = outcomes.slice(0, landed)
  const succeeded = outcomes.filter((o) => o.ok).length
  const polynomial = method !== 'spline'

  const data: PlotMeasurement[] = useMemo(() => {
    const rows = view === 'original' ? bundle.observed.measurements : mergeReconstructions(bundle.observed, new Map(done.map((o) => [o.index, o])))
    return rows.map((m) => ({ index: m.index, x: m.timestamp, y: m.status === 'reconstructed' ? m.reconstructedPingMs : m.observedPingMs, status: m.status }))
  }, [view, bundle, done])

  const inspected = (inspect !== null ? outcomes.find((o) => o.index === inspect) : null) ?? outcomes.find((o) => o.ok) ?? null
  const animating = sweep.playing && view === 'reconstructed'

  return (
    <Section
      id="reconstruction"
      title="Reconstructing the missing values"
      tone="paper"
      intro="Every gap is estimated from measured values only. Estimates are drawn as amber diamonds and are never reused as nodes, so one estimate cannot contaminate the next."
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3" data-reveal>
        <div className="segmented" role="group" aria-label="Interpolation method">
          {METHODS.map((m) => (
            <button key={m} type="button" aria-pressed={method === m} onClick={() => setMethod(m)}>
              {METHOD_SHORT_LABELS[m]}
            </button>
          ))}
        </div>
        <div className={`flex items-center gap-1.5 ${polynomial ? '' : 'opacity-45'}`}>
          <span className="field-label">Nodes</span>
          <button type="button" className="btn btn-secondary btn-sm !px-2.5" aria-label="Fewer nodes" disabled={!polynomial || nodeCount <= NODE_COUNT_RANGE.min} onClick={() => setNodeCount(nodeCount - 1)}>
            −
          </button>
          <span className="num w-6 text-center text-sm">{nodeCount}</span>
          <button type="button" className="btn btn-secondary btn-sm !px-2.5" aria-label="More nodes" disabled={!polynomial || nodeCount >= NODE_COUNT_RANGE.max} onClick={() => setNodeCount(nodeCount + 1)}>
            +
          </button>
        </div>
        <div className="segmented" role="group" aria-label="Graph shown">
          <button type="button" aria-pressed={view === 'original'} onClick={() => setView('original')}>
            Original
          </button>
          <button type="button" aria-pressed={view === 'reconstructed'} onClick={() => setView('reconstructed')}>
            Reconstructed
          </button>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            setView('reconstructed')
            sweep.play()
          }}
        >
          Replay reconstruction
        </button>
      </div>

      <div ref={chart} className="card mt-5 p-4 sm:p-5" data-reveal>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold" data-testid="reconstruction-status" aria-live="polite">
            {view === 'original'
              ? `Original: ${n} missing records`
              : landed < n
                ? `Estimating t = ${fmtSeconds(current?.timestamp ?? 0)} s with ${METHOD_SHORT_LABELS[method]}: ${landed} of ${n}`
                : `${succeeded} of ${n} gaps estimated with ${METHOD_LABELS[method]}`}
          </p>
          <div className="flex flex-wrap gap-x-4 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-brown" /> measured
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rotate-45 bg-amber" /> estimated
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-crimson" /> missing
            </span>
          </div>
        </div>
        <LatencyPlot
          data={data}
          height={340}
          curve={animating && current?.ok ? curves[k] : undefined}
          curveReveal={segment(f, 0, 0.65)}
          nodes={animating && current?.ok && polynomial ? current.nodes : undefined}
          scanX={animating && current ? current.timestamp : null}
          selectedIndex={inspected?.index ?? null}
          onSelectMissing={(i) => setInspect(i)}
          connectReconstructed={view === 'reconstructed' && landed === n}
          label={view === 'original' ? 'The incomplete series' : 'The series with reconstructed values'}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 [&>*]:min-w-0 gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="card p-4 sm:p-5" data-reveal>
          <p className="text-sm font-semibold">Estimates</p>
          <div className="mt-2 max-h-[300px] overflow-auto">
            <table className="w-full text-sm" data-testid="estimates-table">
              <thead className="sticky top-0 bg-white text-left text-xs text-muted">
                <tr className="border-b border-rule">
                  <th className="py-1.5 font-semibold">Time</th>
                  <th className="py-1.5 text-right font-semibold">Estimate</th>
                  <th className="py-1.5 text-right font-semibold">Nodes</th>
                </tr>
              </thead>
              <tbody>
                {outcomes.map((o) => (
                  <tr
                    key={o.index}
                    className={`cursor-pointer border-b border-rule last:border-0 hover:bg-paper ${inspected?.index === o.index ? 'bg-amber-soft' : ''}`}
                    onClick={() => setInspect(o.index)}
                  >
                    <td className="num py-1.5">{fmtSeconds(o.timestamp)} s</td>
                    {o.ok ? (
                      <>
                        <td className="num py-1.5 text-right text-amber-ink">{fmt(o.value, 2)} ms</td>
                        <td className="num py-1.5 text-right text-muted">
                          {o.method === 'spline' ? `all ${o.nodes.length}` : `${fmtSeconds(o.nodes[0].x)}–${fmtSeconds(o.nodes[o.nodes.length - 1].x)} s`}
                        </td>
                      </>
                    ) : (
                      <td colSpan={2} className="py-1.5 text-right text-crimson" title={o.reason}>
                        not interpolable
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card min-w-0 p-4 sm:p-5" data-reveal data-testid="intermediate-steps">
          {inspected?.ok ? (
            <>
              <p className="mb-2 text-sm font-semibold">
                Working for t = {fmtSeconds(inspected.timestamp)} s: <span className="num text-amber-ink">{fmt(inspected.value, 2)} ms</span>
              </p>
              <div className="overflow-x-auto">
                <ReconstructionSteps outcome={inspected} />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">Select an estimate to see its intermediate values.</p>
          )}
        </div>
      </div>
    </Section>
  )
}
