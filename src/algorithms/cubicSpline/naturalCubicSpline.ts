import type {
  NaturalCubicSpline,
  Point,
  SplineResult,
  SplineSegment,
  TridiagonalSystem,
} from '../../types/interpolation'
import { assertWithinDomain, validateNodes } from '../shared/validation'

/**
 * Natural cubic spline through n+1 nodes x_0 < … < x_n (spacing may be uneven).
 *
 * With h_i = x_{i+1} − x_i and M_i = S″(x_i), continuity of S′ at each interior knot gives
 *
 *   h_{i−1} M_{i−1} + 2 (h_{i−1} + h_i) M_i + h_i M_{i+1}
 *       = 6 [ (y_{i+1} − y_i)/h_i − (y_i − y_{i−1})/h_{i−1} ],   i = 1 … n−1
 *
 * and the natural boundary conditions set M_0 = M_n = 0. The system is tridiagonal and
 * strictly diagonally dominant, so the Thomas algorithm solves it without pivoting.
 *
 * On [x_i, x_{i+1}], with t = x − x_i:
 *   a_i = y_i
 *   b_i = (y_{i+1} − y_i)/h_i − h_i (2 M_i + M_{i+1}) / 6
 *   c_i = M_i / 2
 *   d_i = (M_{i+1} − M_i) / (6 h_i)
 */
export function buildNaturalCubicSpline(nodes: readonly Point[]): NaturalCubicSpline {
  const sorted = validateNodes(nodes, 2)
  const n = sorted.length - 1 // number of intervals
  const xs = sorted.map((p) => p.x)
  const ys = sorted.map((p) => p.y)
  const h = Array.from({ length: n }, (_, i) => xs[i + 1] - xs[i])

  const lower: number[] = []
  const diagonal: number[] = []
  const upper: number[] = []
  const rhs: number[] = []
  for (let i = 1; i < n; i++) {
    lower.push(h[i - 1])
    diagonal.push(2 * (h[i - 1] + h[i]))
    upper.push(h[i])
    rhs.push(6 * ((ys[i + 1] - ys[i]) / h[i] - (ys[i] - ys[i - 1]) / h[i - 1]))
  }
  const system: TridiagonalSystem = { lower, diagonal, upper, rhs }

  const interior = solveTridiagonal(system)
  const secondDerivatives = [0, ...interior, 0]

  const segments: SplineSegment[] = h.map((hi, i) => {
    const m0 = secondDerivatives[i]
    const m1 = secondDerivatives[i + 1]
    return {
      x0: xs[i],
      x1: xs[i + 1],
      a: ys[i],
      b: (ys[i + 1] - ys[i]) / hi - (hi * (2 * m0 + m1)) / 6,
      c: m0 / 2,
      d: (m1 - m0) / (6 * hi),
    }
  })

  const segmentIndexFor = (x: number): number => {
    assertWithinDomain(x, sorted)
    // binary search for the interval with x0 ≤ x; the last node belongs to the last interval
    let lo = 0
    let hi = n - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (segments[mid].x0 <= x) lo = mid
      else hi = mid - 1
    }
    return lo
  }

  const evaluate = (x: number): number => {
    const s = segments[segmentIndexFor(x)]
    const t = x - s.x0
    return s.a + t * (s.b + t * (s.c + t * s.d))
  }

  const derivative = (x: number, order: 1 | 2): number => {
    const s = segments[segmentIndexFor(x)]
    const t = x - s.x0
    return order === 1 ? s.b + 2 * s.c * t + 3 * s.d * t * t : 2 * s.c + 6 * s.d * t
  }

  return { nodes: sorted, h, system, secondDerivatives, segments, evaluate, derivative, segmentIndexFor }
}

/** Thomas algorithm for the interior unknowns. Returns [] when there are none. */
function solveTridiagonal({ lower, diagonal, upper, rhs }: TridiagonalSystem): number[] {
  const size = diagonal.length
  if (size === 0) return []
  const c = new Array<number>(size)
  const d = new Array<number>(size)
  c[0] = upper[0] / diagonal[0]
  d[0] = rhs[0] / diagonal[0]
  for (let i = 1; i < size; i++) {
    const denom = diagonal[i] - lower[i] * c[i - 1]
    c[i] = upper[i] / denom
    d[i] = (rhs[i] - lower[i] * d[i - 1]) / denom
  }
  const solution = new Array<number>(size)
  solution[size - 1] = d[size - 1]
  for (let i = size - 2; i >= 0; i--) solution[i] = d[i] - c[i] * solution[i + 1]
  return solution
}

export function splineInterpolate(nodes: readonly Point[], x: number, prebuilt?: NaturalCubicSpline): SplineResult {
  const spline = prebuilt ?? buildNaturalCubicSpline(nodes)
  const segmentIndex = spline.segmentIndexFor(x)
  const segment = spline.segments[segmentIndex]
  const t = x - segment.x0
  const terms: [number, number, number, number] = [segment.a, segment.b * t, segment.c * t * t, segment.d * t ** 3]
  const value = terms[0] + terms[1] + terms[2] + terms[3]
  return { method: 'spline', x, value, nodes: spline.nodes, spline, segmentIndex, segment, t, terms }
}
