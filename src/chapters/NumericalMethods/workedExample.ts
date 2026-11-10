import { lagrangeInterpolate, lagrangePolynomial } from '../../algorithms/lagrange/lagrange'
import { newtonInterpolate } from '../../algorithms/newton/newton'
import { splineInterpolate } from '../../algorithms/cubicSpline/naturalCubicSpline'
import { selectNodesAround } from '../../algorithms/nodeSelection'
import { TIMELINE_EXAMPLE } from '../../data/datasets'
import { DEFAULT_NODE_COUNT } from '../../reconstruction/reconstruct'
import type { Point } from '../../types/interpolation'

/**
 * Chapter 5 worked example, computed by the real algorithms from the chapter 3 timeline:
 * known values at t = 1, 2, 3, 5, 7 s; we estimate the missing record at t = 4 s.
 */
export function computeWorkedExample() {
  const known: Point[] = TIMELINE_EXAMPLE.flatMap((p) => (p.ping === null ? [] : [{ x: p.t, y: p.ping }]))
  const target = 4
  const nodes = selectNodesAround(known, target, DEFAULT_NODE_COUNT)
  const lagrange = lagrangeInterpolate(nodes, target)
  const newton = newtonInterpolate(nodes, target)
  const spline = splineInterpolate(known, target)

  const poly = lagrangePolynomial(nodes)
  const sample = (f: (x: number) => number, lo: number, hi: number) =>
    Array.from({ length: 121 }, (_, k) => {
      const x = lo + ((hi - lo) * k) / 120
      return { x, y: f(x) }
    })

  return {
    known,
    target,
    nodes,
    lagrange,
    newton,
    spline,
    curves: {
      polynomial: sample(poly, nodes[0].x, nodes[nodes.length - 1].x),
      spline: sample(spline.spline.evaluate, known[0].x, known[known.length - 1].x),
    },
  }
}

export type WorkedExample = ReturnType<typeof computeWorkedExample>
