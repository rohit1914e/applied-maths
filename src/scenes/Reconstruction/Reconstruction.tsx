import { useMemo, useState } from 'react'
import { SceneHeader } from '../../components/presentation/SceneHeader'
import { LatencyPlot } from '../../components/graphs/LatencyPlot'
import { toPlotData } from '../../components/graphs/plotData'
import { ReconstructionSteps } from '../../components/math/ReconstructionSteps'
import { useScene } from '../../experience/SceneContext'
import { useStoreValue } from '../../experience/store'
import { segment } from '../../experience/timeline'
import { useDataset } from '../../state/DatasetContext'
import { mergeReconstructions, NODE_COUNT_RANGE, reconstruct, sampleCurve } from '../../reconstruction/reconstruct'
import { METHOD_SHORT_LABELS, METHODS } from '../../types/interpolation'
import type { ReconstructionOutcome } from '../../types/measurement'
import { fmt, fmtSeconds } from '../../utils/format'

/** Content progress over which the gaps are filled, one after another. */
const SWEEP = [0.08, 0.86] as const

export default function Reconstruction() {
  const { progress } = useScene()
  const p = useStoreValue(progress)
  const { bundle, method, setMethod, nodeCount, setNodeCount } = useDataset()
  const [inspect, setInspect] = useState<number | null>(null)

  const outcomes = useMemo(() => reconstruct(bundle.observed, bundle.missingIndices, { method, nodeCount }), [bundle, method, nodeCount])
  const curves = useMemo(() => outcomes.map((o) => sampleCurve(o, 90)), [outcomes])

  const n = outcomes.length
  const q = segment(p, ...SWEEP) * n
  const k = Math.min(n, Math.floor(q))
  const f = q - k
  const current = k < n ? outcomes[k] : null
  const landed = k + (current && f > 0.72 ? 1 : 0)
  const done = outcomes.slice(0, landed)
  const merged = mergeReconstructions(bundle.observed, new Map(done.map((o) => [o.index, o])))
  const succeeded = outcomes.filter((o) => o.ok).length

  const inspected = (inspect !== null ? outcomes.find((o) => o.index === inspect) : null) ?? (current?.ok ? current : done.filter((o) => o.ok).at(-1)) ?? null
  const polynomial = method !== 'spline'

  const lede =
    landed === 0
      ? `${n} records are missing. Each will be estimated from measured values only; estimates are never reused as nodes.`
      : landed < n
        ? `Estimating t = ${fmtSeconds(current?.timestamp ?? 0)} s with ${METHOD_SHORT_LABELS[method]}: ${landed} of ${n} done.`
        : `${succeeded} of ${n} gaps estimated with ${METHOD_SHORT_LABELS[method]}. Brown values were measured; amber values are estimates.`

  return (
    <div className="absolute inset-0 bg-ivory px-[104px] pt-[56px]">
      <SceneHeader number={5} title="Reconstructing Missing Measurements" lede={<span data-testid="reconstruction-status">{lede}</span>} />

      <div className="mt-5">
        <LatencyPlot
          width={1712}
          height={420}
          data={toPlotData(merged)}
          curve={current?.ok ? curves[k] : undefined}
          curveReveal={segment(f, 0, 0.65)}
          nodes={current?.ok && polynomial ? current.nodes : undefined}
          scanX={current ? current.timestamp : null}
          selectedIndex={inspected?.index ?? null}
          onSelectMissing={(i) => setInspect(i)}
          label="Dataset with gaps being reconstructed one by one"
        />
      </div>

      <div className="mt-4 grid grid-cols-[440px_380px_1fr] gap-x-[44px]">
        <div className="space-y-4">
          <div>
            <p className="field-label">Method</p>
            <div className="segmented mt-1.5" role="group" aria-label="Interpolation method">
              {METHODS.map((m) => (
                <button key={m} type="button" aria-pressed={method === m} onClick={() => setMethod(m)}>
                  {METHOD_SHORT_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
          <div className={polynomial ? '' : 'opacity-45'}>
            <p className="field-label">Nodes per polynomial</p>
            <div className="mt-1.5 flex items-center gap-3">
              <button type="button" className="btn btn-quiet !px-4 !py-1.5" aria-label="Fewer nodes" disabled={!polynomial || nodeCount <= NODE_COUNT_RANGE.min} onClick={() => setNodeCount(nodeCount - 1)}>
                −
              </button>
              <span className="num w-[190px] text-center text-[21px] whitespace-nowrap" data-testid="node-count">
                {nodeCount} (degree {nodeCount - 1})
              </span>
              <button type="button" className="btn btn-quiet !px-4 !py-1.5" aria-label="More nodes" disabled={!polynomial || nodeCount >= NODE_COUNT_RANGE.max} onClick={() => setNodeCount(nodeCount + 1)}>
                +
              </button>
            </div>
          </div>
          <Legend />
        </div>

        <div>
          <p className="text-[20px] font-semibold">Estimates so far</p>
          <ol className="mt-1 space-y-0.5 text-[19px]" data-testid="reconstruction-log">
            {done
              .slice(-7)
              .reverse()
              .map((o) => (
                <LogRow key={o.index} o={o} onClick={() => setInspect(o.index)} active={inspected?.index === o.index} />
              ))}
            {done.length === 0 && <li className="text-muted">None yet. Scroll or press Space.</li>}
          </ol>
        </div>

        <div className="min-w-0" data-testid="intermediate-steps">
          {inspected?.ok ? (
            <>
              <p className="mb-1 text-[20px] font-semibold">
                Working for t = {fmtSeconds(inspected.timestamp)} s: <span className="num text-amber-ink">{fmt(inspected.value, 2)} ms</span>
              </p>
              <ReconstructionSteps outcome={inspected} />
            </>
          ) : (
            <p className="small-copy text-muted">The intermediate values of each estimate appear here. Click a crimson marker to inspect a gap.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function LogRow({ o, onClick, active }: { o: ReconstructionOutcome; onClick: () => void; active: boolean }) {
  return (
    <li>
      <button type="button" onClick={onClick} className={`flex w-full justify-between rounded px-1 text-left hover:bg-paper ${active ? 'bg-paper' : ''}`}>
        <span className="num">t = {fmtSeconds(o.timestamp)} s</span>
        {o.ok ? <span className="num text-amber-ink">{fmt(o.value, 2)} ms</span> : <span className="text-crimson">not interpolable</span>}
      </button>
    </li>
  )
}

function Legend() {
  return (
    <ul className="space-y-1.5 text-[19px]" aria-label="Legend">
      <li className="flex items-center gap-3">
        <svg width="22" height="22" aria-hidden="true">
          <circle cx="11" cy="11" r="6" fill="#633f32" />
        </svg>
        Measured value
      </li>
      <li className="flex items-center gap-3">
        <svg width="22" height="22" aria-hidden="true">
          <rect x="5" y="5" width="12" height="12" transform="rotate(45 11 11)" fill="#c18b52" stroke="#633f32" strokeWidth="2" />
        </svg>
        Estimated by interpolation
      </li>
      <li className="flex items-center gap-3">
        <svg width="22" height="22" aria-hidden="true">
          <circle cx="11" cy="11" r="7" fill="#faf8f4" stroke="#8e252d" strokeWidth="3" />
        </svg>
        Missing record
      </li>
    </ul>
  )
}
