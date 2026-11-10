import { useMemo } from 'react'
import { SceneHeader } from '../../components/presentation/SceneHeader'
import { Tex } from '../../components/typography/Tex'
import { linearScale, niceTicks } from '../../components/graphs/scale'
import { useScene } from '../../experience/SceneContext'
import { useStoreValue } from '../../experience/store'
import { segment } from '../../experience/timeline'
import { useDataset } from '../../state/DatasetContext'
import { reconstruct } from '../../reconstruction/reconstruct'
import { chooseFocusGap } from '../../reconstruction/focus'
import { lagrangeBasisFunction, lagrangePolynomial } from '../../algorithms/lagrange/lagrange'
import { newtonPartialPolynomial } from '../../algorithms/newton/newton'
import type { LagrangeResult, NewtonResult, Point, SplineResult } from '../../types/interpolation'
import type { DatasetBundle } from '../../types/measurement'
import { fmt, fmtSeconds } from '../../utils/format'
import { PHASES, phaseAt, type Phase } from './timing'

const PLOT = { w: 1016, h: 410, m: { top: 20, right: 20, bottom: 50, left: 70 } }
const PANEL = { w: 1016, h: 200 }
const BASIS_COLOURS = ['#633f32', '#8e252d', '#7f5426', '#5f5751', '#a0522d', '#3a332e', '#b07a3a', '#6b4b3e', '#94564c', '#252525']

const n4 = (v: number) => fmt(v, 4)
const xs = (v: number) => fmtSeconds(v)
const signed = (v: number, first: boolean) => (first ? n4(v) : v < 0 ? `- ${n4(-v)}` : `+ ${n4(v)}`)

function sample(f: (x: number) => number, lo: number, hi: number, count = 120): Point[] {
  return Array.from({ length: count + 1 }, (_, k) => {
    const x = lo + ((hi - lo) * k) / count
    return { x, y: f(x) }
  })
}

/** Everything the scene draws, computed from the real algorithms for the focus gap. */
function buildModel(bundle: DatasetBundle, nodeCount: number) {
  const focus = chooseFocusGap(bundle)
  if (focus === null) return null
  const [lag, newt, spl] = (['lagrange', 'newton', 'spline'] as const).map((method) => reconstruct(bundle.observed, [focus], { method, nodeCount })[0])
  if (!lag.ok || !newt.ok || !spl.ok) return null
  const lagrange = lag.detail as LagrangeResult
  const newton = newt.detail as NewtonResult
  const spline = spl.detail as SplineResult
  const nodes = lagrange.nodes
  const x0 = nodes[0].x
  const x1 = nodes[nodes.length - 1].x
  const ms = bundle.observed.measurements
  const span = x1 - x0
  const lo = Math.max(ms[0].timestamp, x0 - span * 0.4)
  const hi = Math.min(ms[ms.length - 1].timestamp, x1 + span * 0.4)
  const inView = ms.filter((m) => m.timestamp >= lo - 1e-9 && m.timestamp <= hi + 1e-9)

  const polyCurve = sample(lagrangePolynomial(nodes), x0, x1)
  const basis = nodes.map((_, i) => sample(lagrangeBasisFunction(nodes, i), x0, x1))
  const partials = nodes.map((_, k) => sample(newtonPartialPolynomial(nodes, k), x0, x1))
  const segments = spline.spline.segments
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.x0 >= lo - 1e-9 && s.x1 <= hi + 1e-9)
    .map(({ s, i }) => ({ i, points: sample(spline.spline.evaluate, s.x0, s.x1, 30) }))

  const values = [
    ...inView.flatMap((m) => (m.observedPingMs === null ? [] : [m.observedPingMs])),
    ...polyCurve.map((pt) => pt.y),
    ...segments.flatMap((s) => s.points.map((pt) => pt.y)),
    ...partials.flatMap((c) => c.map((pt) => pt.y)),
  ]
  const vlo = Math.min(...values)
  const vhi = Math.max(...values)
  const pad = Math.max(1, (vhi - vlo) * 0.1)
  const yt = niceTicks(vlo - pad, vhi + pad, 5)
  const yDom: [number, number] = [Math.min(vlo - pad, yt[0]), Math.max(vhi + pad, yt.at(-1)!)]
  const basisValues = basis.flatMap((c) => c.map((pt) => pt.y))
  const bDom: [number, number] = [Math.min(-0.2, ...basisValues) - 0.1, Math.max(1, ...basisValues) + 0.1]

  return { focus, target: ms[focus].timestamp, lagrange, newton, spline, nodes, lo, hi, inView, polyCurve, basis, partials, segments, yDom, yTicks: yt, bDom }
}

type Model = NonNullable<ReturnType<typeof buildModel>>

export default function Interpolation() {
  const { progress, goTo } = useScene()
  const p = useStoreValue(progress)
  const { bundle, nodeCount } = useDataset()

  const model = useMemo(() => buildModel(bundle, nodeCount), [bundle, nodeCount])

  if (!model) {
    return (
      <div className="absolute inset-0 bg-ivory px-[104px] pt-[56px]">
        <SceneHeader number={4} title="The Mathematics of Reconstruction" />
        <p className="body-copy mt-10 max-w-[1000px] text-crimson" role="alert">
          The active dataset has no missing record with measured neighbours on both sides. Choose a dataset with gaps in scene 3.
        </p>
      </div>
    )
  }

  const phase = phaseAt(p)
  const s = phase === 'lagrange' || phase === 'newton' || phase === 'spline' ? segment(p, PHASES[phase][0], PHASES[phase][1]) : phase === 'compare' ? 1 : 0
  const done = s >= 0.92

  const x = linearScale([model.lo, model.hi], [PLOT.m.left, PLOT.w - PLOT.m.right])
  const y = linearScale(model.yDom, [PLOT.h - PLOT.m.bottom, PLOT.m.top])
  const path = (pts: readonly Point[]) => pts.map((pt, i) => `${i ? 'L' : 'M'}${x(pt.x).toFixed(1)},${y(pt.y).toFixed(1)}`).join('')

  // what the main plot shows for this phase
  const curves: { key: string; d: string; reveal: number; colour: string; width: number; dashed?: boolean }[] = []
  const estimates: { value: number; label: string; colour: string }[] = []
  if (phase === 'lagrange') {
    curves.push({ key: 'P', d: path(model.polyCurve), reveal: segment(s, 0.55, 0.9), colour: '#c18b52', width: 4 })
    if (done) estimates.push({ value: model.lagrange.value, label: 'P', colour: '#c18b52' })
  } else if (phase === 'newton') {
    const q = segment(s, 0.05, 0.75) * (model.partials.length - 1)
    const k = Math.min(model.partials.length - 2, Math.floor(q))
    const f = q - k
    const a = model.partials[Math.max(0, k)]
    const b = model.partials[Math.min(model.partials.length - 1, k + 1)]
    const morph = a.map((pt, i) => ({ x: pt.x, y: pt.y + (b[i].y - pt.y) * f }))
    curves.push({ key: 'N', d: path(morph), reveal: 1, colour: '#c18b52', width: 4 })
    if (done) estimates.push({ value: model.newton.value, label: 'P', colour: '#c18b52' })
  } else if (phase === 'spline') {
    const n = model.segments.length
    model.segments.forEach((sg, j) => {
      curves.push({ key: `S${sg.i}`, d: path(sg.points), reveal: segment(s, (j / n) * 0.8, ((j + 1) / n) * 0.8), colour: j % 2 ? '#c18b52' : '#a8743f', width: 4 })
    })
    if (done) estimates.push({ value: model.spline.value, label: 'S', colour: '#c18b52' })
  } else if (phase === 'compare') {
    curves.push({ key: 'P', d: path(model.polyCurve), reveal: 1, colour: '#c18b52', width: 4 })
    model.segments.forEach((sg) => curves.push({ key: `S${sg.i}`, d: path(sg.points), reveal: 1, colour: '#8e252d', width: 3, dashed: true }))
    estimates.push({ value: model.lagrange.value, label: 'P', colour: '#c18b52' }, { value: model.spline.value, label: 'S', colour: '#8e252d' })
  }

  const tabs: { id: Phase; label: string; at: number }[] = [
    { id: 'lagrange', label: 'Lagrange', at: PHASES.lagrange[0] },
    { id: 'newton', label: 'Newton', at: PHASES.newton[0] },
    { id: 'spline', label: 'Cubic spline', at: PHASES.spline[0] },
    { id: 'compare', label: 'Compare', at: PHASES.compare[0] + 0.07 },
  ]
  const nodeSet = new Set(model.nodes.map((nd) => nd.x))
  const baseline = PLOT.h - PLOT.m.bottom

  return (
    <div className="absolute inset-0 bg-ivory px-[104px] pt-[56px]">
      <SceneHeader
        number={4}
        title="The Mathematics of Reconstruction"
        lede={`Zoom into the missing record at t = ${xs(model.target)} s. ${phase === 'spline' || phase === 'compare' ? `The spline uses every measured point; ${model.nodes.length} local nodes feed the polynomial.` : `The ${model.nodes.length} nearest measurements, at least one on each side, are the nodes.`}`}
      />

      <div className="mt-6 grid grid-cols-[640px_1fr] gap-x-[56px]">
        {/* left: method, equations, intermediate values */}
        <div className="min-w-0">
          <div className="segmented" role="tablist" aria-label="Interpolation method">
            {tabs.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={phase === t.id} onClick={() => goTo(t.at)}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="mt-5" data-testid="derivation">
            {phase === 'intro' && <IntroText model={model} />}
            {phase === 'lagrange' && <LagrangeWork r={model.lagrange} s={s} />}
            {phase === 'newton' && <NewtonWork r={model.newton} s={s} />}
            {phase === 'spline' && <SplineWork r={model.spline} s={s} />}
            {phase === 'compare' && <Compare model={model} />}
          </div>
        </div>

        {/* right: the curve being built */}
        <div className="min-w-0">
          <svg width={PLOT.w} height={PLOT.h} viewBox={`0 0 ${PLOT.w} ${PLOT.h}`} className="block overflow-visible" role="img" aria-label="Known points near the gap and the interpolating curve" data-testid="interp-plot">
            {model.yTicks.map((t) => (
              <g key={t}>
                <line x1={PLOT.m.left} x2={PLOT.w - PLOT.m.right} y1={y(t)} y2={y(t)} stroke="#e4dccf" strokeWidth={1.5} />
                <text x={PLOT.m.left - 12} y={y(t)} dy="0.35em" textAnchor="end" fontSize={18} fill="#5f5751" className="num">
                  {fmt(t, Number.isInteger(t) ? 0 : 1)}
                </text>
              </g>
            ))}
            <line x1={PLOT.m.left} x2={PLOT.w - PLOT.m.right} y1={baseline} y2={baseline} stroke="#5f5751" strokeWidth={2} />
            {model.inView.map((m) => (
              <text key={`t${m.index}`} x={x(m.timestamp)} y={baseline + 28} textAnchor="middle" fontSize={17} fill="#5f5751" className="num">
                {xs(m.timestamp)}
              </text>
            ))}
            <text x={PLOT.w - PLOT.m.right} y={baseline + 48} textAnchor="end" fontSize={17} fill="#5f5751">
              time (s)
            </text>
            <text x={4} y={PLOT.m.top - 4} fontSize={17} fill="#5f5751">
              ms
            </text>
            <line x1={x(model.target)} x2={x(model.target)} y1={PLOT.m.top} y2={baseline} stroke="#8e252d" strokeWidth={2} strokeDasharray="6 7" strokeOpacity={0.7} />
            {curves.map((c) => (
              c.dashed ? (
                <path key={c.key} d={c.d} fill="none" stroke={c.colour} strokeWidth={c.width} strokeDasharray="9 7" />
              ) : (
                <path key={c.key} d={c.d} pathLength={1} fill="none" stroke={c.colour} strokeWidth={c.width} strokeLinecap="round" strokeDasharray="1 1" strokeDashoffset={1 - c.reveal} />
              )
            ))}
            {model.inView.map((m) =>
              m.status === 'missing' ? (
                <circle key={m.index} cx={x(m.timestamp)} cy={baseline} r={m.index === model.focus ? 11 : 8} fill="#faf8f4" stroke="#8e252d" strokeWidth={3} />
              ) : (
                <circle
                  key={m.index}
                  cx={x(m.timestamp)}
                  cy={y(m.observedPingMs!)}
                  r={nodeSet.has(m.timestamp) && phase !== 'spline' ? 11 : 7}
                  fill={nodeSet.has(m.timestamp) && phase !== 'spline' ? '#faf8f4' : '#633f32'}
                  stroke="#633f32"
                  strokeWidth={4}
                />
              ),
            )}
            {estimates.map((e, i) => {
              // labels sit to the left of the gap, stacked, with a halo so curves never cut through them
              const above = estimates.length === 1 || e.value >= Math.max(...estimates.map((o) => o.value))
              const ly = Math.max(PLOT.m.top + 20, y(e.value) + (above ? -26 : 40))
              return (
                <g key={e.label} data-testid="interp-estimate">
                  <rect x={x(model.target) - 10} y={y(e.value) - 10} width={20} height={20} transform={`rotate(45 ${x(model.target)} ${y(e.value)})`} fill={e.colour} stroke="#633f32" strokeWidth={2} opacity={i === 0 ? 1 : 0.95} />
                  <text x={x(model.target) - 22} y={ly} textAnchor="end" fontSize={23} fill={e.colour === '#8e252d' ? '#8e252d' : '#7f5426'} stroke="#faf8f4" strokeWidth={7} paintOrder="stroke" className="num">
                    {e.label}({xs(model.target)}) = {fmt(e.value, 2)} ms
                  </text>
                </g>
              )
            })}
          </svg>

          <div className="mt-4" style={{ height: PANEL.h }}>
            {phase === 'lagrange' && <BasisPanel model={model} s={s} xScale={x} />}
            {phase === 'newton' && <DividedDifferences r={model.newton} s={s} />}
            {phase === 'spline' && <SecondDerivatives model={model} s={s} xScale={x} />}
            {(phase === 'intro' || phase === 'compare') && (
              <p className="small-copy max-w-[900px] text-muted">
                Brown circles are measurements; ringed ones are the polynomial's nodes. The crimson line marks the missing time.
                {phase === 'compare' && ' Amber: the polynomial shared by Lagrange and Newton. Dashed crimson: the natural cubic spline.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function IntroText({ model }: { model: Model }) {
  return (
    <div className="space-y-4">
      <p className="body-copy">
        Interpolation draws a curve that passes exactly through the measured points, then reads the curve at the missing time.
      </p>
      <p className="body-copy text-muted">
        Nodes: <span className="num text-charcoal">{model.nodes.map((nd) => `(${xs(nd.x)}, ${fmt(nd.y, 1)})`).join('  ')}</span>
      </p>
      <p className="body-copy text-muted">Scroll to build the curve three ways.</p>
    </div>
  )
}

function LagrangeWork({ r, s }: { r: LagrangeResult; s: number }) {
  return (
    <div>
      <div className="text-[22px]">
        <Tex tex="P(x) = \sum_{i} y_i L_i(x),\qquad L_i(x) = \prod_{j \ne i} \frac{x - x_j}{x_i - x_j}" display />
      </div>
      <table className="mt-1 w-full text-[19px]">
        <tbody>
          {r.basis.map((b, i) => {
            const show = s > 0.08 + i * (0.45 / r.basis.length)
            const num = b.factors.map((f) => `(${xs(f.numerator)})`).join('')
            const den = b.factors.map((f) => `(${xs(f.denominator)})`).join('')
            return (
              <tr key={b.i} className="border-b border-rule" style={{ visibility: show ? 'visible' : 'hidden' }}>
                <td className="py-0.5">
                  <Tex tex={`L_{${b.i}} = \\tfrac{${num}}{${den}} = ${n4(b.basisValue)}`} />
                </td>
                <td className="num py-0.5 text-right whitespace-nowrap text-muted">
                  {fmt(b.yi, 1)} × {n4(b.basisValue)} = <span className="text-charcoal">{n4(b.term)}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="mt-2 text-[22px]" style={{ visibility: s >= 0.92 ? 'visible' : 'hidden' }}>
        <Tex tex={`P(${xs(r.x)}) = ${r.basis.map((b, i) => signed(b.term, i === 0)).join(' ')} = \\mathbf{${n4(r.value)}}`} display />
      </div>
    </div>
  )
}

function NewtonWork({ r, s }: { r: NewtonResult; s: number }) {
  const k = Math.min(r.coefficients.length - 1, Math.floor(segment(s, 0.05, 0.75) * (r.coefficients.length - 1) + 1e-9))
  const termList = r.coefficients.slice(0, k + 1).map((a, i) => `${signed(a, i === 0)}${r.nodes.slice(0, i).map((nd) => `(x - ${xs(nd.x)})`).join('')}`)
  // two terms per line keeps the expansion inside the column
  const lines: string[] = []
  for (let i = 0; i < termList.length; i += 2) lines.push(termList.slice(i, i + 2).join(' '))
  const terms = `\\begin{aligned} P_{${k}}(x) &= ${lines.join(' \\\\ &\\quad ')} \\end{aligned}`
  return (
    <div>
      <div className="text-[22px]">
        <Tex tex="P(x) = a_0 + a_1(x-x_0) + a_2(x-x_0)(x-x_1) + \cdots" display />
        <Tex tex="a_k = f[x_0,\dots,x_k]" display />
      </div>
      <p className="small-copy mt-2 text-muted">
        Adding one divided difference at a time: P<sub>{k}</sub> passes through the first {k + 1} node{k ? 's' : ''}.
      </p>
      <div className="mt-1 text-[19px]" data-testid="newton-partial">
        <Tex tex={terms} display />
      </div>
      <ol className="num mt-1 space-y-0.5 text-[18px]" style={{ visibility: s >= 0.8 ? 'visible' : 'hidden' }}>
        {r.nested.map((st) => (
          <li key={st.k}>
            <Tex tex={st.multiplier === null ? `b_{${st.k}} = a_{${st.k}} = ${n4(st.accumulated)}` : `b_{${st.k}} = ${n4(st.coefficient)} + (${xs(st.multiplier)})\\,b_{${st.k + 1}} = ${st.k === 0 ? `\\mathbf{${n4(st.accumulated)}}` : n4(st.accumulated)}`} />
          </li>
        ))}
      </ol>
    </div>
  )
}

function SplineWork({ r, s }: { r: SplineResult; s: number }) {
  const sp = r.spline
  const seg = r.segment
  return (
    <div>
      <div className="text-[21px]">
        <Tex tex="S_i(x) = a_i + b_i t + c_i t^2 + d_i t^3,\quad t = x - x_i" display />
        <Tex tex="h_{i-1}M_{i-1} + 2(h_{i-1}+h_i)M_i + h_iM_{i+1} = 6\left(\tfrac{y_{i+1}-y_i}{h_i} - \tfrac{y_i-y_{i-1}}{h_{i-1}}\right)" display />
      </div>
      <p className="small-copy mt-1 text-muted">
        {sp.nodes.length} knots give {sp.system.diagonal.length} equations for M<sub>1</sub>…M<sub>{sp.nodes.length - 2}</sub>, with M<sub>0</sub> = M<sub>{sp.nodes.length - 1}</sub> = 0. The Thomas algorithm solves them in one sweep each way.
      </p>
      <div style={{ visibility: s >= 0.7 ? 'visible' : 'hidden' }}>
        <p className="small-copy mt-2">
          t = {xs(r.x)} lies in [{xs(seg.x0)}, {xs(seg.x1)}]; t − x<sub>i</sub> = {fmt(r.t, 3)}.
        </p>
        <div className="text-[19px]">
          <Tex tex={`a = ${n4(seg.a)},\\ b = ${n4(seg.b)},\\ c = \\tfrac{M_{${r.segmentIndex}}}{2} = ${n4(seg.c)},\\ d = ${n4(seg.d)}`} display />
        </div>
      </div>
      <div className="text-[21px]" style={{ visibility: s >= 0.92 ? 'visible' : 'hidden' }}>
        <Tex tex={`S(${xs(r.x)}) = ${r.terms.map((t, i) => signed(t, i === 0)).join(' ')} = \\mathbf{${n4(r.value)}}`} display />
      </div>
    </div>
  )
}

function Compare({ model }: { model: Model }) {
  const rows = [
    ['Lagrange', model.lagrange.value, `${model.nodes.length} nodes, degree ${model.nodes.length - 1}`],
    ['Newton', model.newton.value, 'same nodes, same polynomial'],
    ['Natural cubic spline', model.spline.value, `${model.spline.spline.nodes.length} knots, piecewise cubic`],
  ] as const
  const diff = Math.abs(model.lagrange.value - model.newton.value)
  return (
    <div>
      <p className="body-copy">Three estimates of the same missing value:</p>
      <table className="mt-3 w-full text-[22px]" data-testid="compare-table">
        <tbody>
          {rows.map(([name, v, note]) => (
            <tr key={name} className="border-b border-rule">
              <td className="py-2">{name}</td>
              <td className="num py-2 text-right text-amber-ink">{fmt(v, 2)} ms</td>
              <td className="py-2 pl-6 text-[18px] text-muted">{note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small-copy mt-4 text-muted">
        Lagrange and Newton agree{diff < 1e-9 ? ' to within 10⁻⁹ ms' : `, differing by ${fmt(diff, 6)} ms`}: through {model.nodes.length} distinct points there is exactly one polynomial of degree {model.nodes.length - 1}. The spline differs by {fmt(Math.abs(model.spline.value - model.lagrange.value), 2)} ms because it is a different interpolant.
      </p>
    </div>
  )
}

function BasisPanel({ model, s, xScale }: { model: Model; s: number; xScale: (v: number) => number }) {
  const y = linearScale(model.bDom, [PANEL.h - 22, 8])
  const n = model.basis.length
  return (
    <svg width={PANEL.w} height={PANEL.h} className="block overflow-visible" role="img" aria-label="Lagrange basis polynomials" data-testid="basis-panel">
      <line x1={PLOT.m.left} x2={PLOT.w - PLOT.m.right} y1={y(0)} y2={y(0)} stroke="#cdbfac" strokeWidth={1.5} />
      <line x1={PLOT.m.left} x2={PLOT.w - PLOT.m.right} y1={y(1)} y2={y(1)} stroke="#e4dccf" strokeWidth={1.5} strokeDasharray="4 6" />
      <text x={PLOT.m.left - 12} y={y(0)} dy="0.35em" textAnchor="end" fontSize={16} fill="#5f5751" className="num">
        0
      </text>
      <text x={PLOT.m.left - 12} y={y(1)} dy="0.35em" textAnchor="end" fontSize={16} fill="#5f5751" className="num">
        1
      </text>
      {model.basis.map((curve, i) => {
        const reveal = segment(s, 0.05 + (i * 0.45) / n, 0.05 + ((i + 1) * 0.45) / n)
        const d = curve.map((pt, k) => `${k ? 'L' : 'M'}${xScale(pt.x).toFixed(1)},${y(pt.y).toFixed(1)}`).join('')
        return (
          <g key={i}>
            <path d={d} pathLength={1} fill="none" stroke={BASIS_COLOURS[i % BASIS_COLOURS.length]} strokeWidth={2.5} strokeDasharray="1 1" strokeDashoffset={1 - reveal} />
            {reveal > 0.95 && (
              <text x={xScale(model.nodes[i].x)} y={y(1) - 8} textAnchor="middle" fontSize={17} fill={BASIS_COLOURS[i % BASIS_COLOURS.length]} className="num">
                L{i}
              </text>
            )}
          </g>
        )
      })}
      <text x={PLOT.w - PLOT.m.right} y={PANEL.h - 2} textAnchor="end" fontSize={16} fill="#5f5751">
        each Lᵢ is 1 at its own node and 0 at the others
      </text>
    </svg>
  )
}

function DividedDifferences({ r, s }: { r: NewtonResult; s: number }) {
  const cols = r.table.length
  const shown = Math.min(cols, Math.floor(segment(s, 0, 0.75) * cols) + 1)
  return (
    <table className="num w-full text-[18px]" data-testid="divided-differences">
      <thead>
        <tr className="border-b-2 border-rule text-muted">
          <th className="py-1 pr-3 text-right font-normal">
            <Tex tex="x_i" />
          </th>
          {Array.from({ length: cols }, (_, k) => (
            <th key={k} className="py-1 pr-3 text-right font-normal" style={{ visibility: k < shown ? 'visible' : 'hidden' }}>
              <Tex tex={k === 0 ? 'f[x_i]' : `f[${Array(k + 1).fill('\\cdot').join(',')}]`} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {r.nodes.map((nd, i) => (
          <tr key={i} className="border-b border-rule">
            <td className="py-0.5 pr-3 text-right">{xs(nd.x)}</td>
            {r.table.map((column, k) => (
              <td key={k} className={`py-0.5 pr-3 text-right ${i === 0 ? 'font-semibold text-crimson' : ''}`} style={{ visibility: k < shown ? 'visible' : 'hidden' }}>
                {i < column.length ? n4(column[i]) : ''}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function SecondDerivatives({ model, s, xScale }: { model: Model; s: number; xScale: (v: number) => number }) {
  const sp = model.spline.spline
  const knots = sp.nodes.map((nd, i) => ({ x: nd.x, m: sp.secondDerivatives[i], i })).filter((k) => k.x >= model.lo - 1e-9 && k.x <= model.hi + 1e-9)
  const mMax = Math.max(1e-9, ...knots.map((k) => Math.abs(k.m)))
  const mid = PANEL.h / 2 - 4
  const scale = (PANEL.h / 2 - 48) / mMax
  const reveal = segment(s, 0.1, 0.6)
  return (
    <svg width={PANEL.w} height={PANEL.h} className="block overflow-visible" role="img" aria-label="Second derivatives of the spline at the knots in view">
      <line x1={PLOT.m.left} x2={PLOT.w - PLOT.m.right} y1={mid} y2={mid} stroke="#cdbfac" strokeWidth={1.5} />
      <text x={PLOT.m.left - 12} y={mid} dy="0.35em" textAnchor="end" fontSize={16} fill="#5f5751">
        M = 0
      </text>
      {knots.map((k) => (
        <g key={k.i}>
          <line x1={xScale(k.x)} x2={xScale(k.x)} y1={mid} y2={mid - k.m * scale * reveal} stroke="#8e252d" strokeWidth={3} />
          <circle cx={xScale(k.x)} cy={mid - k.m * scale * reveal} r={5} fill="#8e252d" />
          <text x={xScale(k.x)} y={mid - k.m * scale * reveal + (k.m >= 0 ? -12 : 24)} textAnchor="middle" fontSize={15} fill="#5f5751" className="num" opacity={reveal}>
            {fmt(k.m, 2)}
          </text>
        </g>
      ))}
      <text x={PLOT.w - PLOT.m.right} y={14} textAnchor="end" fontSize={16} fill="#5f5751">
        Mᵢ = S″(xᵢ), solved from the tridiagonal system
      </text>
    </svg>
  )
}
