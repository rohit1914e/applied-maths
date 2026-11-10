import { useMemo, useState } from 'react'
import type { ChapterProps } from '../../types/presentation'
import { ChapterFrame, Reveal } from '../../components/presentation/ChapterFrame'
import { Tex } from '../../components/typography/Tex'
import { LatencyPlot, type PlotMeasurement } from '../../components/graphs/LatencyPlot'
import { TIMELINE_EXAMPLE } from '../../data/datasets'
import { METHOD_LABELS, type InterpolationMethod } from '../../types/interpolation'
import { fmt } from '../../utils/format'
import { computeWorkedExample, type WorkedExample } from './workedExample'

/** Integer values print plainly; others to 4 decimals. Negatives are parenthesised inside products. */
const n = (v: number, paren = false) => {
  const s = Number.isInteger(v) ? String(v) : fmt(v, 4)
  return paren && v < 0 ? `(${s})` : s
}
const xs = (v: number) => (Number.isInteger(v) ? String(v) : fmt(v, 3))

const FORMULAS: Record<InterpolationMethod, { tex: string[]; text: string }> = {
  lagrange: {
    tex: ['P(x) = \\sum_{i=0}^{n} y_i\\,L_i(x)', 'L_i(x) = \\prod_{j \\ne i} \\frac{x - x_j}{x_i - x_j}'],
    text: 'Each basis polynomial equals 1 at its own node and 0 at every other node, so P passes through every known point.',
  },
  newton: {
    tex: [
      'P(x) = a_0 + a_1(x-x_0) + a_2(x-x_0)(x-x_1) + \\cdots',
      'a_k = f[x_0,\\dots,x_k],\\quad f[x_i,\\dots,x_{i+k}] = \\frac{f[x_{i+1},\\dots,x_{i+k}] - f[x_i,\\dots,x_{i+k-1}]}{x_{i+k}-x_i}',
    ],
    text: 'The same polynomial as Lagrange, written so that adding a node adds one term. Nested multiplication evaluates it in n steps.',
  },
  spline: {
    tex: [
      'S_i(x) = a_i + b_i t + c_i t^2 + d_i t^3,\\quad t = x - x_i',
      'h_{i-1}M_{i-1} + 2(h_{i-1}+h_i)M_i + h_iM_{i+1} = 6\\left(\\frac{y_{i+1}-y_i}{h_i} - \\frac{y_i-y_{i-1}}{h_{i-1}}\\right)',
    ],
    text: 'One cubic per interval. Values, slopes and curvatures match at every knot; the natural ends have M₀ = Mₙ = 0, where M = S″.',
  },
}

export default function NumericalMethods({ step }: ChapterProps) {
  const [method, setMethod] = useState<InterpolationMethod>('lagrange')
  const ex = useMemo(() => computeWorkedExample(), [])
  const estimate = method === 'lagrange' ? ex.lagrange.value : method === 'newton' ? ex.newton.value : ex.spline.value

  const plotData: PlotMeasurement[] = TIMELINE_EXAMPLE.map((p, i) => {
    if (p.ping !== null) return { index: i, x: p.t, y: p.ping, status: 'observed' }
    if (p.t === ex.target && step >= 3) return { index: i, x: p.t, y: estimate, status: 'reconstructed' }
    return { index: i, x: p.t, y: null, status: 'missing' }
  })
  const curve = step >= 3 ? (method === 'spline' ? ex.curves.spline : ex.curves.polynomial) : undefined
  const usedNodes = method === 'spline' ? ex.known : ex.nodes

  return (
    <ChapterFrame
      number={5}
      title="The Mathematics Behind Reconstruction"
      lede="Worked example from chapter 3: known values at t = 1, 2, 3, 5 and 7 s. We estimate the missing record at t = 4 s."
    >
      <div className="grid h-full grid-cols-[640px_1fr] gap-x-[56px]">
        <div className="flex min-h-0 flex-col">
          <div className="segmented self-start" role="tablist" aria-label="Interpolation method">
            {(['lagrange', 'newton', 'spline'] as const).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={method === m} onClick={() => setMethod(m)}>
                {m === 'spline' ? 'Cubic spline' : METHOD_LABELS[m].split(' ')[0]}
              </button>
            ))}
          </div>
          <h2 className="section-heading mt-6">{METHOD_LABELS[method]}</h2>
          <div className="mt-3 space-y-1 text-[25px]" data-testid="method-formula">
            {FORMULAS[method].tex.map((t) => (
              <Tex key={t} tex={t} display />
            ))}
          </div>
          <p className="body-copy mt-2 text-muted">{FORMULAS[method].text}</p>

          <Reveal visible={step >= 3} className="mt-auto border-t-2 border-rule pt-4">
            <p className="text-[21px] text-muted">Estimated latency at t = {ex.target} s</p>
            <p className="num text-[64px] leading-tight text-amber-ink" data-testid="worked-estimate">
              {fmt(estimate, 2)} <span className="text-[30px]">ms</span>
            </p>
            <p className="small-copy text-muted">
              {method === 'spline'
                ? `Uses all ${ex.known.length} known points. Lagrange and Newton, using 4 local nodes, give ${fmt(ex.lagrange.value, 2)} ms.`
                : `Newton gives ${fmt(ex.newton.value, 2)} ms as well${Math.abs(ex.lagrange.value - ex.newton.value) < 1e-9 ? ' (difference below 10⁻⁹ ms)' : ''}: same nodes, same polynomial.`}
            </p>
          </Reveal>
        </div>

        <div className="flex min-w-0 flex-col">
          <div className="min-h-0 flex-1 text-[22px]" data-testid="derivation">
            {method === 'lagrange' && <LagrangeSteps ex={ex} step={step} />}
            {method === 'newton' && <NewtonSteps ex={ex} step={step} />}
            {method === 'spline' && <SplineSteps ex={ex} step={step} />}
          </div>
          <div className="shrink-0">
            <LatencyPlot
              width={1016}
              height={280}
              data={plotData}
              curve={curve}
              curveKey={`${method}-${step >= 3}`}
              nodes={step >= 1 ? usedNodes : undefined}
              yDomain={[22, 50]}
              selectedIndex={3}
              label="Worked example: known values, missing slots and the interpolant"
            />
          </div>
        </div>
      </div>
    </ChapterFrame>
  )
}

function StepHint({ step }: { step: number }) {
  if (step > 0) return null
  return <p className="small-copy text-muted">Press Space to build the solution: construction, substitution, then the estimate.</p>
}

function LagrangeSteps({ ex, step }: { ex: WorkedExample; step: number }) {
  const { lagrange, target } = ex
  if (step === 0) return <StepHint step={step} />
  return (
    <div>
      <p className="small-copy text-muted">
        Nodes nearest to t = {target}, at least one on each side:{' '}
        <span className="num text-charcoal">{lagrange.nodes.map((p) => `(${xs(p.x)}, ${n(p.y)})`).join('  ')}</span>
      </p>
      <table className="mt-2 w-full">
        <tbody>
          {lagrange.basis.map((b) => {
            const symNum = b.factors.map((f) => `(x - ${xs(f.xj)})`).join('')
            const symDen = b.factors.map((f) => `(${xs(b.xi)} - ${xs(f.xj)})`).join('')
            const numNum = b.factors.map((f) => `(${n(f.numerator)})`).join('')
            const numDen = b.factors.map((f) => `(${n(f.denominator)})`).join('')
            const pNum = b.factors.reduce((p, f) => p * f.numerator, 1)
            const pDen = b.factors.reduce((p, f) => p * f.denominator, 1)
            return (
              <tr key={b.i} className="border-b border-rule">
                <td className="py-0.5">
                  {step === 1 ? (
                    <Tex tex={`L_{${b.i}}(x) = \\dfrac{${symNum}}{${symDen}}`} />
                  ) : (
                    <Tex tex={`L_{${b.i}}(${target}) = \\dfrac{${numNum}}{${numDen}} = \\dfrac{${n(pNum)}}{${n(pDen)}} = ${n(b.basisValue)}`} />
                  )}
                </td>
                <td className="num pl-4 text-right text-[20px] whitespace-nowrap">
                  {step >= 2 && (
                    <>
                      y<sub>{b.i}</sub>·L<sub>{b.i}</sub> = {n(b.yi)} × {n(b.basisValue, true)} = <span className="text-charcoal">{fmt(b.term, 4)}</span>
                    </>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {step >= 2 && (
        <div className="mt-2 text-[24px]">
          <Tex tex={`P(${target}) = ${lagrange.basis.map((b, i) => (i === 0 ? fmt(b.term, 4) : b.term < 0 ? `- ${fmt(-b.term, 4)}` : `+ ${fmt(b.term, 4)}`)).join(' ')}${step >= 3 ? ` = \\mathbf{${fmt(lagrange.value, 4)}}` : ''}`} display />
        </div>
      )}
    </div>
  )
}

function NewtonSteps({ ex, step }: { ex: WorkedExample; step: number }) {
  const { newton, target } = ex
  if (step === 0) return <StepHint step={step} />
  const size = newton.nodes.length
  const headers = ['x_i', 'f[x_i]', ...Array.from({ length: size - 1 }, (_, k) => `f[${Array(k + 2).fill('\\cdot').join(',')}]`)]
  const terms = newton.coefficients
    .map((a, k) => {
      const factors = newton.nodes.slice(0, k).map((p) => `(x - ${xs(p.x)})`).join('')
      const coef = k === 0 ? fmt(a, 4) : a < 0 ? `- ${fmt(-a, 4)}` : `+ ${fmt(a, 4)}`
      return `${coef}${factors}`
    })
    .join(' ')
  return (
    <div>
      <table className="num w-full text-[20px]" data-testid="divided-differences">
        <thead>
          <tr className="border-b-2 border-rule text-muted">
            {headers.map((h) => (
              <th key={h} className="py-1 pr-3 text-right font-normal">
                <Tex tex={h} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {newton.nodes.map((p, i) => (
            <tr key={i} className="border-b border-rule">
              <td className="py-1 pr-3 text-right">{xs(p.x)}</td>
              {newton.table.map((column, k) => (
                <td key={k} className={`py-1 pr-3 text-right ${i === 0 ? 'font-semibold text-crimson' : ''}`}>
                  {i < column.length ? fmt(column[i], 4) : ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small-copy mt-1 text-muted">The first row (crimson) holds the coefficients a₀ … a₃.</p>
      {step >= 2 && (
        <>
          <div className="mt-1 text-[21px]">
            <Tex tex={`P(x) = ${terms}`} display />
          </div>
          <ol className="num grid grid-cols-2 gap-x-6 text-[19px]" data-testid="nested-steps">
            {newton.nested.map((s) => (
              <li key={s.k}>
                {s.multiplier === null ? (
                  <Tex tex={`b_{${s.k}} = a_{${s.k}} = ${fmt(s.accumulated, 4)}`} />
                ) : (
                  <Tex tex={`b_{${s.k}} = ${fmt(s.coefficient, 4)} + ${n(s.multiplier, true)}\\,b_{${s.k + 1}} = ${s.k === 0 && step >= 3 ? `\\mathbf{${fmt(s.accumulated, 4)}}` : fmt(s.accumulated, 4)}`} />
                )}
              </li>
            ))}
          </ol>
          <p className="small-copy mt-1 text-muted">Nested multiplication at x = {target}: P({target}) = b₀.</p>
        </>
      )}
    </div>
  )
}

function SplineSteps({ ex, step }: { ex: WorkedExample; step: number }) {
  const { spline: result, target } = ex
  const s = result.spline
  if (step === 0) return <StepHint step={step} />
  const k = s.system.diagonal.length
  const row = (r: number) =>
    Array.from({ length: k }, (_, c) => (c === r ? n(s.system.diagonal[r]) : c === r - 1 ? n(s.system.lower[r]) : c === r + 1 ? n(s.system.upper[r]) : '0')).join(' & ')
  const matrix = `\\begin{bmatrix} ${Array.from({ length: k }, (_, r) => row(r)).join(' \\\\ ')} \\end{bmatrix}`
  const unknowns = `\\begin{bmatrix} ${Array.from({ length: k }, (_, r) => `M_{${r + 1}}`).join(' \\\\ ')} \\end{bmatrix}`
  const rhs = `\\begin{bmatrix} ${s.system.rhs.map((v) => n(v)).join(' \\\\ ')} \\end{bmatrix}`
  const seg = result.segment
  return (
    <div>
      <p className="small-copy text-muted">
        All {s.nodes.length} known points are knots. Interval widths{' '}
        <span className="num text-charcoal">{s.h.map((h, i) => `h${i} = ${n(h)}`).join(',  ')}</span>
      </p>
      <div className="mt-1 text-[22px]">
        <Tex tex={`${matrix}${unknowns} = ${rhs},\\qquad M_0 = M_{${s.nodes.length - 1}} = 0`} display />
      </div>
      {step >= 2 && (
        <>
          <p className="small-copy text-muted">
            Solved by the Thomas algorithm:{' '}
            <span className="num text-charcoal">{s.secondDerivatives.map((m, i) => `M${i} = ${fmt(m, 4)}`).join(',  ')}</span>
          </p>
          <p className="small-copy mt-2">
            t = {target} lies in [{xs(seg.x0)}, {xs(seg.x1)}], so t − x<sub>i</sub> = {fmt(result.t, 2)} and
          </p>
          <div className="text-[21px]">
            <Tex
              tex={`a = ${fmt(seg.a, 4)},\\; b = ${fmt(seg.b, 4)},\\; c = \\tfrac{M_{${result.segmentIndex}}}{2} = ${fmt(seg.c, 4)},\\; d = \\tfrac{M_{${result.segmentIndex + 1}} - M_{${result.segmentIndex}}}{6h} = ${fmt(seg.d, 4)}`}
              display
            />
            <Tex
              tex={`S(${target}) = ${result.terms.map((t, i) => (i === 0 ? fmt(t, 4) : t < 0 ? `- ${fmt(-t, 4)}` : `+ ${fmt(t, 4)}`)).join(' ')}${step >= 3 ? ` = \\mathbf{${fmt(result.value, 4)}}` : ''}`}
              display
            />
          </div>
        </>
      )}
    </div>
  )
}
