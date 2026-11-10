import type { ReconstructionOutcome } from '../../types/measurement'
import { fmt, fmtSeconds } from '../../utils/format'

/** The intermediate values behind one reconstruction, as returned by the algorithms. */
export function ReconstructionSteps({ outcome }: { outcome: Extract<ReconstructionOutcome, { ok: true }> }) {
  const d = outcome.detail
  if (d.method === 'lagrange') {
    return (
      <table className="num w-full text-sm">
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
            <tr key={b.i} className="border-t border-line">
              <td>{b.i}</td>
              <td className="text-right">{fmtSeconds(b.xi)}</td>
              <td className="text-right">{fmt(b.yi, 1)}</td>
              <td className="text-right">{fmt(b.basisValue, 5)}</td>
              <td className="text-right">{fmt(b.term, 4)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-line font-semibold">
            <td colSpan={3} className="font-sans">P(x) = Σ yᵢ·Lᵢ(x)</td>
            <td className="text-right">Σ Lᵢ = {fmt(d.basis.reduce((s, b) => s + b.basisValue, 0), 5)}</td>
            <td className="text-right text-estimate-ink">{fmt(d.value, 4)}</td>
          </tr>
        </tbody>
      </table>
    )
  }
  if (d.method === 'newton') {
    return (
      <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
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
    <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
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
          <li className="text-estimate-ink">S(x) = {fmt(d.value, 4)}</li>
        </ul>
      </div>
    </div>
  )
}
