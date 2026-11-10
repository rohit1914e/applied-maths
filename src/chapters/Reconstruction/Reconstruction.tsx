import { useMemo, useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import type { ChapterProps } from '../../types/presentation'
import { ChapterFrame } from '../../components/presentation/ChapterFrame'
import { LatencyPlot } from '../../components/graphs/LatencyPlot'
import { toPlotData } from '../../components/graphs/plotData'
import { useDataset } from '../../state/DatasetContext'
import { mergeReconstructions, NODE_COUNT_RANGE, reconstruct, sampleCurve } from '../../reconstruction/reconstruct'
import { METHOD_SHORT_LABELS, METHODS } from '../../types/interpolation'
import type { ReconstructionOutcome } from '../../types/measurement'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { fmt, fmtSeconds } from '../../utils/format'

export default function Reconstruction(_props: ChapterProps) {
  const { bundle, method, setMethod, nodeCount, setNodeCount, reconstructions, recordReconstructions, clearReconstructions } = useDataset()
  const missing = bundle.missingIndices
  const [cursor, setCursor] = useState(0)
  const [outcome, setOutcome] = useState<ReconstructionOutcome | null>(null)
  const [runId, setRunId] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const valueRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  const selectedIndex = missing.length ? missing[Math.min(cursor, missing.length - 1)] : null
  const selected = selectedIndex === null ? null : bundle.observed.measurements[selectedIndex]
  const polynomial = method !== 'spline'

  const merged = useMemo(() => mergeReconstructions(bundle.observed, reconstructions), [bundle, reconstructions])
  const curve = useMemo(() => (outcome ? sampleCurve(outcome) : undefined), [outcome])

  // The value is revealed after the curve has been drawn through the known points.
  useGSAP(
    () => {
      if (!outcome || !valueRef.current || reduced) return
      gsap.fromTo(valueRef.current, { opacity: 0 }, { opacity: 1, duration: 0.5, delay: outcome.ok ? 1.1 : 0 })
    },
    { dependencies: [runId, reduced] },
  )

  const select = (index: number) => {
    const pos = missing.indexOf(index)
    if (pos < 0) return
    setCursor(pos)
    setOutcome(null)
  }

  const run = () => {
    if (selectedIndex === null) return
    const [result] = reconstruct(bundle.observed, [selectedIndex], { method, nodeCount })
    setOutcome(result)
    setRunId((r) => r + 1)
    setNotice(null)
    if (result.ok) recordReconstructions([result])
  }

  const runAll = () => {
    const results = reconstruct(bundle.observed, missing, { method, nodeCount })
    recordReconstructions(results)
    const failed = results.filter((r) => !r.ok).length
    setNotice(
      `${results.length - failed} of ${results.length} missing records reconstructed with ${METHOD_SHORT_LABELS[method]}.` +
        (failed ? ` ${failed} could not be interpolated (no known value on one side).` : ''),
    )
    setOutcome(null)
  }

  const changeMethod = (m: typeof method) => {
    setMethod(m)
    setOutcome(null)
  }

  return (
    <ChapterFrame
      number={6}
      title="Reconstructing Missing Measurements"
      lede="Pick a method and a missing record, then interpolate on the active dataset. Every number is computed live."
    >
      <div className="grid h-full grid-cols-[480px_1fr] gap-x-[52px]">
        <div className="flex min-h-0 flex-col gap-5">
          <div>
            <p className="field-label">Method</p>
            <div className="segmented mt-1.5" role="group" aria-label="Interpolation method">
              {METHODS.map((m) => (
                <button key={m} type="button" aria-pressed={method === m} onClick={() => changeMethod(m)}>
                  {METHOD_SHORT_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          <div aria-disabled={!polynomial} className={polynomial ? '' : 'opacity-45'}>
            <p className="field-label">Nodes in the local polynomial</p>
            <div className="mt-1.5 flex items-center gap-3">
              <button type="button" className="btn btn-quiet px-4 py-2" aria-label="Fewer nodes" disabled={!polynomial || nodeCount <= NODE_COUNT_RANGE.min} onClick={() => { setNodeCount(nodeCount - 1); setOutcome(null) }}>
                −
              </button>
              <span className="num w-[230px] text-center text-[22px] whitespace-nowrap" data-testid="node-count">
                {nodeCount} (degree {nodeCount - 1})
              </span>
              <button type="button" className="btn btn-quiet px-4 py-2" aria-label="More nodes" disabled={!polynomial || nodeCount >= NODE_COUNT_RANGE.max} onClick={() => { setNodeCount(nodeCount + 1); setOutcome(null) }}>
                +
              </button>
            </div>
            <p className="mt-1 text-[18px] text-muted">{polynomial ? 'Lagrange and Newton share this window.' : 'The spline always uses every observed point.'}</p>
          </div>

          <div>
            <p className="field-label">Missing record</p>
            {selected ? (
              <div className="mt-1.5 flex items-center gap-3">
                <button type="button" className="btn btn-quiet px-4 py-2" aria-label="Previous missing record" disabled={cursor === 0} onClick={() => { setCursor(cursor - 1); setOutcome(null) }}>
                  <Chevron dir="left" />
                </button>
                <span className="num min-w-[190px] text-center text-[24px]" data-testid="selected-record">
                  t = {fmtSeconds(selected.timestamp)} s
                </span>
                <button type="button" className="btn btn-quiet px-4 py-2" aria-label="Next missing record" disabled={cursor >= missing.length - 1} onClick={() => { setCursor(cursor + 1); setOutcome(null) }}>
                  <Chevron dir="right" />
                </button>
                <span className="text-[18px] text-muted">
                  {cursor + 1} of {missing.length}
                </span>
              </div>
            ) : (
              <p className="small-copy mt-1.5 text-muted">This dataset has no missing records. Hide some in chapter 4.</p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn" onClick={run} disabled={!selected}>
              Reconstruct
            </button>
            <button type="button" className="btn btn-quiet" onClick={runAll} disabled={!missing.length}>
              Reconstruct all
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => { clearReconstructions(); setOutcome(null); setNotice(null) }} disabled={reconstructions.size === 0}>
              Clear
            </button>
          </div>

          <div ref={valueRef} className="min-h-[120px]" aria-live="polite" data-testid="reconstruction-result">
            {outcome?.ok && (
              <>
                <p className="text-[20px] text-muted">
                  Reconstructed at t = {fmtSeconds(outcome.timestamp)} s with {METHOD_SHORT_LABELS[outcome.method]}
                </p>
                <p className="num text-[60px] leading-tight text-amber-ink" data-testid="reconstructed-value">
                  {fmt(outcome.value, 2)} <span className="text-[28px]">ms</span>
                </p>
              </>
            )}
            {outcome && !outcome.ok && (
              <p role="alert" className="text-[21px] font-semibold text-crimson">
                {outcome.reason}
              </p>
            )}
            {notice && <p className="text-[21px] text-brown" role="status">{notice}</p>}
          </div>
        </div>

        <div className="flex min-w-0 flex-col">
          <LatencyPlot
            width={1180}
            height={380}
            data={toPlotData(merged)}
            curve={curve}
            curveKey={String(runId)}
            nodes={outcome?.ok && outcome.method !== 'spline' ? outcome.nodes : undefined}
            selectedIndex={selectedIndex}
            onSelectMissing={select}
            label="Dataset with missing records, nodes and the interpolating curve"
          />
          <div className="mt-3 min-h-0 flex-1 border-t-2 border-rule pt-3" data-testid="intermediate-steps">
            {outcome?.ok ? <Steps outcome={outcome} /> : <p className="small-copy text-muted">Intermediate values appear here after you press Reconstruct. Click a crimson marker on the time axis to choose a record.</p>}
          </div>
        </div>
      </div>
    </ChapterFrame>
  )
}

function Steps({ outcome }: { outcome: Extract<ReconstructionOutcome, { ok: true }> }) {
  const d = outcome.detail
  if (d.method === 'lagrange') {
    return (
      <table className="num w-full text-[19px]">
        <thead className="text-left text-muted">
          <tr>
            <th className="font-sans font-semibold">i</th>
            <th className="text-right font-sans font-semibold">x<sub>i</sub> (s)</th>
            <th className="text-right font-sans font-semibold">y<sub>i</sub> (ms)</th>
            <th className="text-right font-sans font-semibold">L<sub>i</sub>(x)</th>
            <th className="text-right font-sans font-semibold">y<sub>i</sub>·L<sub>i</sub>(x)</th>
          </tr>
        </thead>
        <tbody>
          {d.basis.map((b) => (
            <tr key={b.i} className="border-t border-rule">
              <td>{b.i}</td>
              <td className="text-right">{fmtSeconds(b.xi)}</td>
              <td className="text-right">{fmt(b.yi, 1)}</td>
              <td className="text-right">{fmt(b.basisValue, 5)}</td>
              <td className="text-right">{fmt(b.term, 4)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-rule font-semibold">
            <td colSpan={3} className="font-sans">P(x) = Σ yᵢ·Lᵢ(x)</td>
            <td className="text-right">Σ Lᵢ = {fmt(d.basis.reduce((s, b) => s + b.basisValue, 0), 5)}</td>
            <td className="text-right text-amber-ink">{fmt(d.value, 4)}</td>
          </tr>
        </tbody>
      </table>
    )
  }
  if (d.method === 'newton') {
    return (
      <div className="grid grid-cols-2 gap-x-10 text-[19px]">
        <div>
          <p className="font-semibold">Coefficients from the divided-difference table</p>
          <ul className="num mt-1 space-y-0.5">
            {d.coefficients.map((a, k) => (
              <li key={k}>
                a<sub>{k}</sub> = f[x<sub>0</sub>…x<sub>{k}</sub>] = {fmt(a, 6)}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-semibold">Nested evaluation at x = {fmtSeconds(d.x)}</p>
          <ul className="num mt-1 space-y-0.5">
            {d.nested.map((s) => (
              <li key={s.k}>
                b<sub>{s.k}</sub> = {s.multiplier === null ? `a${s.k}` : `${fmt(s.coefficient, 4)} + (${fmt(s.multiplier, 2)})·b${s.k + 1}`} = {fmt(s.accumulated, 4)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }
  const seg = d.segment
  const s = d.spline
  return (
    <div className="grid grid-cols-2 gap-x-10 text-[19px]">
      <div>
        <p className="font-semibold">Spline over {s.nodes.length} observed knots</p>
        <ul className="num mt-1 space-y-0.5">
          <li>
            interval [{fmtSeconds(seg.x0)}, {fmtSeconds(seg.x1)}], h = {fmt(seg.x1 - seg.x0, 3)}
          </li>
          <li>
            M<sub>{d.segmentIndex}</sub> = {fmt(s.secondDerivatives[d.segmentIndex], 5)}, M<sub>{d.segmentIndex + 1}</sub> = {fmt(s.secondDerivatives[d.segmentIndex + 1], 5)}
          </li>
          <li>natural ends: M₀ = M<sub>{s.nodes.length - 1}</sub> = 0</li>
          <li>t = x − x<sub>i</sub> = {fmt(d.t, 3)}</li>
        </ul>
      </div>
      <div>
        <p className="font-semibold">S(x) = a + b·t + c·t² + d·t³</p>
        <ul className="num mt-1 space-y-0.5">
          <li>a = {fmt(seg.a, 4)}, b = {fmt(seg.b, 4)}</li>
          <li>c = {fmt(seg.c, 4)}, d = {fmt(seg.d, 4)}</li>
          <li>terms: {d.terms.map((t) => fmt(t, 4)).join(' + ').replace(/\+ -/g, '− ')}</li>
          <li className="text-amber-ink">S(x) = {fmt(d.value, 4)}</li>
        </ul>
      </div>
    </div>
  )
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
    </svg>
  )
}
