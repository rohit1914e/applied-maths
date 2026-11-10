import { lagrangeBasisFunction, lagrangePolynomial } from '../../algorithms/lagrange/lagrange'
import { newtonPartialPolynomial } from '../../algorithms/newton/newton'
import { niceTicks } from '../../components/graphs/scale'
import { reconstruct } from '../../reconstruction/reconstruct'
import type { LagrangeResult, NewtonResult, Point, SplineResult } from '../../types/interpolation'
import type { DatasetBundle } from '../../types/measurement'

function sample(f: (x: number) => number, lo: number, hi: number, count = 120): Point[] {
  return Array.from({ length: count + 1 }, (_, k) => {
    const x = lo + ((hi - lo) * k) / count
    return { x, y: f(x) }
  })
}

/** Missing records that every method can estimate (measured neighbours on both sides). */
export function interpolableGaps(bundle: DatasetBundle, nodeCount: number): number[] {
  return bundle.missingIndices.filter((i) =>
    (['lagrange', 'newton', 'spline'] as const).every((method) => reconstruct(bundle.observed, [i], { method, nodeCount })[0].ok),
  )
}

/**
 * Everything the methods panels draw for one missing record, computed by the real
 * algorithms: the three results, the curves, the Lagrange basis, the Newton partial
 * polynomials and the spline segments inside a zoomed window around the gap.
 */
export function buildMethodsModel(bundle: DatasetBundle, nodeCount: number, target: number) {
  const [lag, newt, spl] = (['lagrange', 'newton', 'spline'] as const).map((method) => reconstruct(bundle.observed, [target], { method, nodeCount })[0])
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
    .map(({ i, s }) => ({ i, points: sample(spline.spline.evaluate, s.x0, s.x1, 30) }))

  const values = [
    ...inView.flatMap((m) => (m.observedPingMs === null ? [] : [m.observedPingMs])),
    ...polyCurve.map((p) => p.y),
    ...segments.flatMap((s) => s.points.map((p) => p.y)),
    ...partials.flatMap((c) => c.map((p) => p.y)),
  ]
  const vlo = Math.min(...values)
  const vhi = Math.max(...values)
  const pad = Math.max(1, (vhi - vlo) * 0.1)
  const yTicks = niceTicks(vlo - pad, vhi + pad, 5)
  const yDomain: [number, number] = [Math.min(vlo - pad, yTicks[0]), Math.max(vhi + pad, yTicks.at(-1)!)]
  const basisValues = basis.flatMap((c) => c.map((p) => p.y))
  const basisDomain: [number, number] = [Math.min(-0.2, ...basisValues) - 0.1, Math.max(1, ...basisValues) + 0.1]

  return { target, time: ms[target].timestamp, lagrange, newton, spline, nodes, lo, hi, inView, polyCurve, basis, partials, segments, yDomain, yTicks, basisDomain }
}

export type MethodsModel = NonNullable<ReturnType<typeof buildMethodsModel>>
