import { useMemo, useRef, useState } from 'react'
import { Tex } from '../../components/typography/Tex'
import { linearScale } from '../../components/graphs/scale'
import { useConstruction } from '../../hooks/useConstruction'
import { useElementWidth, useFirstView } from '../../hooks/useViewport'
import { useDataset } from '../../state/DatasetContext'
import { chooseFocusGap } from '../../reconstruction/focus'
import { NODE_COUNT_RANGE } from '../../reconstruction/reconstruct'
import type { InterpolationMethod, LagrangeResult, NewtonResult, Point, SplineResult } from '../../types/interpolation'
import { fmt, fmtSeconds } from '../../utils/format'
import { segment } from '../../utils/progress'
import { Section } from '../Section'
import { buildMethodsModel, interpolableGaps, type MethodsModel } from './methodsModel'

const TABS: { id: InterpolationMethod; label: string; short: string }[] = [
  { id: 'lagrange', label: 'Lagrange', short: 'Lagrange' },
  { id: 'newton', label: 'Newton divided differences', short: 'Newton' },
  { id: 'spline', label: 'Natural cubic spline', short: 'Spline' },
]

const ABOUT: Record<InterpolationMethod, { tex: string[]; text: string }> = {
  lagrange: {
    tex: ['P(x) = \\sum_{i=0}^{n} y_i\\,L_i(x)', 'L_i(x) = \\prod_{j \\ne i} \\frac{x - x_j}{x_i - x_j}'],
    text: 'Each basis polynomial Lᵢ equals 1 at its own node and 0 at every other node, so the weighted sum passes through every measured point. The weights Lᵢ(x) show how much each neighbour contributes to the estimate.',
  },
  newton: {
    tex: ['P(x) = a_0 + a_1(x-x_0) + a_2(x-x_0)(x-x_1) + \\cdots', 'a_k = f[x_0,\\dots,x_k] = \\frac{f[x_1,\\dots,x_k] - f[x_0,\\dots,x_{k-1}]}{x_k - x_0}'],
    text: 'The same polynomial as Lagrange, built one divided difference at a time: each new term bends the curve through one more node without changing the earlier ones. Nested multiplication evaluates it in n steps.',
  },
  spline: {
    tex: ['S_i(x) = a_i + b_i t + c_i t^2 + d_i t^3,\\quad t = x - x_i', 'h_{i-1}M_{i-1} + 2(h_{i-1}+h_i)M_i + h_iM_{i+1} = 6\\Big(\\tfrac{y_{i+1}-y_i}{h_i} - \\tfrac{y_i-y_{i-1}}{h_{i-1}}\\Big)'],
    text: 'One cubic per interval between measurements, joined so that value, slope and curvature are continuous. The second derivatives Mᵢ come from a tridiagonal system with natural ends M₀ = Mₙ = 0, solved by the Thomas algorithm.',
  },
}

const BASIS_COLOURS = ['#633f32', '#8e252d', '#c18b52', '#5f5751', '#a0522d', '#3a332e', '#b07a3a', '#6b4b3e', '#94564c', '#252525']
const n4 = (v: number) => fmt(v, 4)
const signed = (v: number, first: boolean) => (first ? n4(v) : v < 0 ? `- ${n4(-v)}` : `+ ${n4(v)}`)

export function MethodsSection() {
  const { bundle, nodeCount, setNodeCount } = useDataset()
  const [method, setMethod] = useState<InterpolationMethod>('lagrange')
  const [picked, setPicked] = useState<number | null>(null)
  const panel = useRef<HTMLDivElement>(null)

  const gaps = useMemo(() => interpolableGaps(bundle, nodeCount), [bundle, nodeCount])
  const target = picked !== null && gaps.includes(picked) ? picked : (chooseFocusGap(bundle) ?? gaps[0] ?? null)
  const model = useMemo(() => (target === null ? null : buildMethodsModel(bundle, nodeCount, target)), [bundle, nodeCount, target])
  const construction = useConstruction(`${method}-${target}-${nodeCount}`, 3)
  useFirstView(panel, construction.play)
  const s = construction.s
  const polynomial = method !== 'spline'

  return (
    <Section
      id="methods"
      title="Three interpolation methods"
      intro="Pick a missing record and a method. The curve is constructed step by step from the actual algorithm, with the equation and every intermediate value beside it."
    >
      {!model ? (
        <p className="card p-5 text-crimson" role="alert">
          This dataset has no missing record with measured neighbours on both sides. Generate a dataset with gaps in the dataset section.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4" data-reveal>
            <div className="segmented max-w-full overflow-x-auto" role="tablist" aria-label="Interpolation method">
              {TABS.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={method === t.id} aria-label={t.label} onClick={() => setMethod(t.id)} className="whitespace-nowrap">
                  <span className="sm:hidden">{t.short}</span>
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <span className="field-label">Missing point</span>
                <select className="field-input w-auto py-1.5" value={target ?? ''} onChange={(e) => setPicked(Number(e.target.value))} aria-label="Missing point">
                  {gaps.map((i) => (
                    <option key={i} value={i}>
                      t = {fmtSeconds(bundle.observed.measurements[i].timestamp)} s
                    </option>
                  ))}
                </select>
              </label>
              <div className={`flex items-center gap-1.5 ${polynomial ? '' : 'opacity-45'}`}>
                <span className="field-label">Nodes</span>
                <button type="button" className="btn btn-secondary btn-sm !px-2.5" aria-label="Fewer nodes" disabled={!polynomial || nodeCount <= NODE_COUNT_RANGE.min} onClick={() => setNodeCount(nodeCount - 1)}>
                  −
                </button>
                <span className="num w-6 text-center text-sm" data-testid="node-count">
                  {nodeCount}
                </span>
                <button type="button" className="btn btn-secondary btn-sm !px-2.5" aria-label="More nodes" disabled={!polynomial || nodeCount >= NODE_COUNT_RANGE.max} onClick={() => setNodeCount(nodeCount + 1)}>
                  +
                </button>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={construction.play}>
                Replay construction
              </button>
            </div>
          </div>

          <div ref={panel} className="mt-5 grid grid-cols-1 [&>*]:min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]" role="tabpanel" aria-label={TABS.find((t) => t.id === method)!.label}>
            <div className="card min-w-0 p-5" data-reveal>
              <h3 className="text-lg font-semibold">{TABS.find((t) => t.id === method)!.label}</h3>
              <div className="mt-2 text-[15px]" data-testid="method-equation">
                {ABOUT[method].tex.map((t) => (
                  <Tex key={t} tex={t} display />
                ))}
              </div>
              <p className="text-[0.95rem] leading-relaxed text-muted">{ABOUT[method].text}</p>
              <div className="mt-4 border-t border-rule pt-4 text-[15px]" data-testid="derivation">
                <p className="mb-2 text-sm font-semibold">Calculation at t = {fmtSeconds(model.time)} s</p>
                {method === 'lagrange' && <LagrangeWork r={model.lagrange} s={s} />}
                {method === 'newton' && <NewtonWork r={model.newton} s={s} />}
                {method === 'spline' && <SplineWork r={model.spline} s={s} />}
              </div>
            </div>

            <div className="card min-w-0 p-4 sm:p-5" data-reveal>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold">Interpolating curve near t = {fmtSeconds(model.time)} s</p>
                <p className="text-xs text-muted">{construction.playing ? 'Constructing…' : 'Ringed points are the nodes'}</p>
              </div>
              <ZoomPlot model={model} method={method} s={s} onPick={(i) => gaps.includes(i) && setPicked(i)} />
              <div className="mt-3">
                {method === 'lagrange' && <BasisPanel model={model} s={s} />}
                {method === 'newton' && <DividedDifferences r={model.newton} s={s} />}
                {method === 'spline' && <SecondDerivatives model={model} s={s} />}
              </div>
              <Estimate model={model} method={method} visible={s >= 0.92} />
            </div>
          </div>
        </>
      )}
    </Section>
  )
}

function Estimate({ model, method, visible }: { model: MethodsModel; method: InterpolationMethod; visible: boolean }) {
  const value = method === 'lagrange' ? model.lagrange.value : method === 'newton' ? model.newton.value : model.spline.value
  const other = method === 'spline' ? model.lagrange.value : model.spline.value
  return (
    <div className="mt-4 flex flex-wrap items-end justify-between gap-3 rounded-lg bg-amber-soft px-4 py-3" style={{ visibility: visible ? 'visible' : 'hidden' }} data-testid="method-estimate">
      <div>
        <p className="text-xs text-amber-ink">Estimated latency at t = {fmtSeconds(model.time)} s</p>
        <p className="num text-[1.75rem] leading-tight text-amber-ink">
          {fmt(value, 2)} <span className="text-sm">ms</span>
        </p>
      </div>
      <p className="max-w-xs text-xs text-muted">
        {method === 'spline'
          ? `The local cubic polynomial (Lagrange and Newton) gives ${fmt(other, 2)} ms.`
          : `Lagrange and Newton agree${Math.abs(model.lagrange.value - model.newton.value) < 1e-9 ? ' to within 10⁻⁹ ms' : ''}; the spline gives ${fmt(other, 2)} ms.`}
      </p>
    </div>
  )
}

function ZoomPlot({ model, method, s, onPick }: { model: MethodsModel; method: InterpolationMethod; s: number; onPick: (index: number) => void }) {
  const [box, width] = useElementWidth<HTMLDivElement>(600)
  const H = 300
  const m = { top: 14, right: 12, bottom: 30, left: 44 }
  const x = linearScale([model.lo, model.hi], [m.left, width - m.right])
  const y = linearScale(model.yDomain, [H - m.bottom, m.top])
  const path = (pts: readonly Point[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`).join('')
  const baseline = H - m.bottom
  const nodeSet = new Set(model.nodes.map((n) => n.x))

  const curves: { key: string; d: string; reveal: number; colour: string }[] = []
  let estimate: number | null = null
  if (method === 'lagrange') {
    curves.push({ key: 'P', d: path(model.polyCurve), reveal: segment(s, 0.55, 0.9), colour: '#c18b52' })
    estimate = model.lagrange.value
  } else if (method === 'newton') {
    const q = segment(s, 0.05, 0.75) * (model.partials.length - 1)
    const k = Math.min(model.partials.length - 2, Math.floor(q))
    const f = q - k
    const a = model.partials[Math.max(0, k)]
    const b = model.partials[Math.min(model.partials.length - 1, k + 1)]
    curves.push({ key: 'N', d: path(a.map((p, i) => ({ x: p.x, y: p.y + (b[i].y - p.y) * f }))), reveal: 1, colour: '#c18b52' })
    estimate = model.newton.value
  } else {
    const n = model.segments.length
    model.segments.forEach((sg, j) => curves.push({ key: `S${sg.i}`, d: path(sg.points), reveal: segment(s, (j / n) * 0.8, ((j + 1) / n) * 0.8), colour: j % 2 ? '#c18b52' : '#a8743f' }))
    estimate = model.spline.value
  }

  return (
    <div ref={box} className="mt-2 w-full">
      <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} className="block overflow-visible" role="img" aria-label="Measured points near the gap and the interpolating curve" data-testid="method-plot">
        {model.yTicks.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke="#ece5d9" />
            <text x={m.left - 8} y={y(t)} dy="0.35em" textAnchor="end" fontSize={11.5} fill="#5f5751" className="num">
              {fmt(t, Number.isInteger(t) ? 0 : 1)}
            </text>
          </g>
        ))}
        <line x1={m.left} x2={width - m.right} y1={baseline} y2={baseline} stroke="#8f8579" />
        {model.inView.map((mm) => (
          <text key={`t${mm.index}`} x={x(mm.timestamp)} y={baseline + 18} textAnchor="middle" fontSize={11.5} fill="#5f5751" className="num">
            {fmtSeconds(mm.timestamp)}
          </text>
        ))}
        <line x1={x(model.time)} x2={x(model.time)} y1={m.top} y2={baseline} stroke="#8e252d" strokeDasharray="4 5" strokeOpacity={0.7} />
        {curves.map((c) => (
          <path key={c.key} d={c.d} pathLength={1} fill="none" stroke={c.colour} strokeWidth={2.75} strokeLinecap="round" strokeDasharray="1 1" strokeDashoffset={1 - c.reveal} />
        ))}
        {model.inView.map((mm) =>
          mm.status === 'missing' ? (
            <circle key={mm.index} cx={x(mm.timestamp)} cy={baseline} r={mm.index === model.target ? 7 : 5} fill="#faf8f4" stroke="#8e252d" strokeWidth={2} style={{ cursor: 'pointer' }} onClick={() => onPick(mm.index)} />
          ) : (
            <circle
              key={mm.index}
              cx={x(mm.timestamp)}
              cy={y(mm.observedPingMs!)}
              r={nodeSet.has(mm.timestamp) && method !== 'spline' ? 7 : 4.5}
              fill={nodeSet.has(mm.timestamp) && method !== 'spline' ? '#faf8f4' : '#633f32'}
              stroke="#633f32"
              strokeWidth={2.5}
            />
          ),
        )}
        {s >= 0.92 && estimate !== null && (
          <g data-testid="estimate-marker">
            <rect x={x(model.time) - 7} y={y(estimate) - 7} width={14} height={14} transform={`rotate(45 ${x(model.time)} ${y(estimate)})`} fill="#c18b52" stroke="#633f32" strokeWidth={1.5} />
            <text x={x(model.time) - 14} y={y(estimate) - 12} textAnchor="end" fontSize={13} fill="#7f5426" stroke="#ffffff" strokeWidth={4} paintOrder="stroke" className="num">
              {fmt(estimate, 2)} ms
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}

function LagrangeWork({ r, s }: { r: LagrangeResult; s: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <tbody>
          {r.basis.map((b, i) => {
            const shown = s > 0.05 + (i * 0.45) / r.basis.length
            const num = b.factors.map((f) => `(${fmtSeconds(f.numerator)})`).join('')
            const den = b.factors.map((f) => `(${fmtSeconds(f.denominator)})`).join('')
            return (
              <tr key={b.i} className="border-b border-rule" style={{ visibility: shown ? 'visible' : 'hidden' }}>
                <td className="py-0.5">
                  <Tex tex={`L_{${b.i}} = \\tfrac{${num}}{${den}} = ${n4(b.basisValue)}`} />
                </td>
                <td className="num py-0.5 text-right text-xs whitespace-nowrap text-muted sm:text-sm">
                  {fmt(b.yi, 1)} × {n4(b.basisValue)} = <span className="text-charcoal">{n4(b.term)}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div style={{ visibility: s >= 0.92 ? 'visible' : 'hidden' }}>
        <Tex tex={`P(${fmtSeconds(r.x)}) = ${r.basis.map((b, i) => signed(b.term, i === 0)).join(' ')} = \\mathbf{${n4(r.value)}}`} display />
      </div>
    </div>
  )
}

function NewtonWork({ r, s }: { r: NewtonResult; s: number }) {
  const k = Math.min(r.coefficients.length - 1, Math.floor(segment(s, 0.05, 0.75) * (r.coefficients.length - 1) + 1e-9))
  const termList = r.coefficients.slice(0, k + 1).map((a, i) => `${signed(a, i === 0)}${r.nodes.slice(0, i).map((nd) => `(x - ${fmtSeconds(nd.x)})`).join('')}`)
  const lines: string[] = []
  for (let i = 0; i < termList.length; i += 2) lines.push(termList.slice(i, i + 2).join(' '))
  return (
    <div>
      <p className="text-sm text-muted">
        P<sub>{k}</sub> passes through the first {k + 1} node{k ? 's' : ''}:
      </p>
      <div data-testid="newton-partial">
        <Tex tex={`\\begin{aligned} P_{${k}}(x) &= ${lines.join(' \\\\ &\\quad ')} \\end{aligned}`} display />
      </div>
      <ol className="space-y-0.5" style={{ visibility: s >= 0.8 ? 'visible' : 'hidden' }}>
        {r.nested.map((st) => (
          <li key={st.k}>
            <Tex tex={st.multiplier === null ? `b_{${st.k}} = a_{${st.k}} = ${n4(st.accumulated)}` : `b_{${st.k}} = ${n4(st.coefficient)} + (${fmtSeconds(st.multiplier)})\\,b_{${st.k + 1}} = ${st.k === 0 ? `\\mathbf{${n4(st.accumulated)}}` : n4(st.accumulated)}`} />
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
      <p className="text-sm text-muted">
        {sp.nodes.length} measured points give {sp.system.diagonal.length} equations for the interior second derivatives.
      </p>
      <div style={{ visibility: s >= 0.6 ? 'visible' : 'hidden' }}>
        <p className="mt-2 text-sm">
          t = {fmtSeconds(r.x)} s lies in [{fmtSeconds(seg.x0)}, {fmtSeconds(seg.x1)}], so t − x<sub>i</sub> = {fmt(r.t, 3)} and
        </p>
        <Tex tex={`a = ${n4(seg.a)},\\ b = ${n4(seg.b)},\\ c = \\tfrac{M_{${r.segmentIndex}}}{2} = ${n4(seg.c)},\\ d = \\tfrac{M_{${r.segmentIndex + 1}} - M_{${r.segmentIndex}}}{6h} = ${n4(seg.d)}`} display />
      </div>
      <div style={{ visibility: s >= 0.92 ? 'visible' : 'hidden' }}>
        <Tex tex={`S(${fmtSeconds(r.x)}) = ${r.terms.map((t, i) => signed(t, i === 0)).join(' ')} = \\mathbf{${n4(r.value)}}`} display />
      </div>
    </div>
  )
}

function BasisPanel({ model, s }: { model: MethodsModel; s: number }) {
  const [box, width] = useElementWidth<HTMLDivElement>(600)
  const H = 150
  const x = linearScale([model.lo, model.hi], [44, width - 12])
  const y = linearScale(model.basisDomain, [H - 16, 8])
  const n = model.basis.length
  return (
    <div ref={box} className="w-full">
      <svg width={width} height={H} className="block overflow-visible" role="img" aria-label="Lagrange basis polynomials" data-testid="basis-panel">
        <line x1={44} x2={width - 12} y1={y(0)} y2={y(0)} stroke="#cdbfac" />
        <line x1={44} x2={width - 12} y1={y(1)} y2={y(1)} stroke="#ece5d9" strokeDasharray="3 5" />
        <text x={36} y={y(0)} dy="0.35em" textAnchor="end" fontSize={11} fill="#5f5751" className="num">
          0
        </text>
        <text x={36} y={y(1)} dy="0.35em" textAnchor="end" fontSize={11} fill="#5f5751" className="num">
          1
        </text>
        {model.basis.map((curve, i) => {
          const reveal = segment(s, 0.05 + (i * 0.45) / n, 0.05 + ((i + 1) * 0.45) / n)
          const d = curve.map((p, k) => `${k ? 'L' : 'M'}${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`).join('')
          return (
            <g key={i}>
              <path d={d} pathLength={1} fill="none" stroke={BASIS_COLOURS[i % BASIS_COLOURS.length]} strokeWidth={2} strokeDasharray="1 1" strokeDashoffset={1 - reveal} />
              {reveal > 0.95 && (
                <text x={x(model.nodes[i].x)} y={y(1) - 6} textAnchor="middle" fontSize={11.5} fill={BASIS_COLOURS[i % BASIS_COLOURS.length]} className="num">
                  L{i}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <p className="text-xs text-muted">Basis polynomials Lᵢ(x): each is 1 at its own node and 0 at the others.</p>
    </div>
  )
}

function DividedDifferences({ r, s }: { r: NewtonResult; s: number }) {
  const cols = r.table.length
  const shown = Math.min(cols, Math.floor(segment(s, 0, 0.75) * cols) + 1)
  return (
    <div className="overflow-x-auto">
      <table className="num w-full text-xs sm:text-sm" data-testid="divided-differences">
        <caption className="pb-1 text-left font-sans text-xs text-muted">Divided-difference table; the first row holds the coefficients a₀…a{cols - 1}.</caption>
        <thead>
          <tr className="border-b border-rule text-muted">
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
            <tr key={i} className="border-b border-rule last:border-0">
              <td className="py-0.5 pr-3 text-right">{fmtSeconds(nd.x)}</td>
              {r.table.map((column, k) => (
                <td key={k} className={`py-0.5 pr-3 text-right ${i === 0 ? 'font-semibold text-crimson' : ''}`} style={{ visibility: k < shown ? 'visible' : 'hidden' }}>
                  {i < column.length ? n4(column[i]) : ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SecondDerivatives({ model, s }: { model: MethodsModel; s: number }) {
  const [box, width] = useElementWidth<HTMLDivElement>(600)
  const H = 150
  const x = linearScale([model.lo, model.hi], [44, width - 12])
  const sp = model.spline.spline
  const knots = sp.nodes.map((nd, i) => ({ x: nd.x, m: sp.secondDerivatives[i], i })).filter((k) => k.x >= model.lo - 1e-9 && k.x <= model.hi + 1e-9)
  const mMax = Math.max(1e-9, ...knots.map((k) => Math.abs(k.m)))
  const mid = H / 2
  const scale = (H / 2 - 22) / mMax
  const reveal = segment(s, 0.1, 0.6)
  return (
    <div ref={box} className="w-full">
      <svg width={width} height={H} className="block overflow-visible" role="img" aria-label="Second derivatives of the spline at the knots in view">
        <line x1={44} x2={width - 12} y1={mid} y2={mid} stroke="#cdbfac" />
        <text x={36} y={mid} dy="0.35em" textAnchor="end" fontSize={11} fill="#5f5751">
          0
        </text>
        {knots.map((k) => (
          <g key={k.i}>
            <line x1={x(k.x)} x2={x(k.x)} y1={mid} y2={mid - k.m * scale * reveal} stroke="#8e252d" strokeWidth={2.5} />
            <circle cx={x(k.x)} cy={mid - k.m * scale * reveal} r={3.5} fill="#8e252d" />
            <text x={x(k.x)} y={mid - k.m * scale * reveal + (k.m >= 0 ? -8 : 16)} textAnchor="middle" fontSize={11} fill="#5f5751" className="num" opacity={reveal}>
              {fmt(k.m, 2)}
            </text>
          </g>
        ))}
      </svg>
      <p className="text-xs text-muted">Second derivatives Mᵢ = S″(xᵢ) at the knots in view, solved from the tridiagonal system.</p>
    </div>
  )
}
