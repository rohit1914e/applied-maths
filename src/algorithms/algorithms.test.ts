import { describe, expect, it } from 'vitest'
import { lagrangeInterpolate, lagrangePolynomial } from './lagrange/lagrange'
import { dividedDifferenceTable, newtonInterpolate, newtonPolynomial } from './newton/newton'
import { buildNaturalCubicSpline, splineInterpolate } from './cubicSpline/naturalCubicSpline'
import { selectNodesAround } from './nodeSelection'
import { InterpolationError, MAX_POLYNOMIAL_NODES, validateNodes } from './shared/validation'
import type { Point } from '../types/interpolation'

const cubic = (x: number) => 2 * x ** 3 - 3 * x ** 2 + x - 5
const cubicNodes: Point[] = [-1, 0.5, 2, 3.5].map((x) => ({ x, y: cubic(x) }))

function expectError(fn: () => unknown, code: InterpolationError['code']) {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(InterpolationError)
    expect((error as InterpolationError).code).toBe(code)
    return
  }
  throw new Error(`expected InterpolationError ${code}`)
}

describe('shared validation', () => {
  it('returns nodes sorted by x without mutating the input', () => {
    const input = [{ x: 3, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 3 }]
    const sorted = validateNodes(input, 2)
    expect(sorted.map((p) => p.x)).toEqual([1, 2, 3])
    expect(input[0].x).toBe(3)
  })

  it('rejects duplicate x-coordinates, including near-duplicates within tolerance', () => {
    expectError(() => validateNodes([{ x: 1, y: 1 }, { x: 1, y: 2 }], 2), 'DUPLICATE_NODES')
    expectError(() => validateNodes([{ x: 1, y: 1 }, { x: 1 + 1e-13, y: 2 }], 2), 'DUPLICATE_NODES')
  })

  it('rejects non-finite values and too few nodes', () => {
    expectError(() => validateNodes([{ x: 1, y: NaN }, { x: 2, y: 1 }], 2), 'NON_FINITE')
    expectError(() => validateNodes([{ x: 1, y: 1 }], 2), 'INSUFFICIENT_NODES')
  })
})

describe('Lagrange interpolation', () => {
  it('recovers a cubic exactly from four nodes', () => {
    for (const x of [-0.7, 0, 1.25, 3]) {
      expect(lagrangeInterpolate(cubicNodes, x).value).toBeCloseTo(cubic(x), 10)
    }
  })

  it('reproduces the data at every node', () => {
    for (const node of cubicNodes) {
      expect(lagrangeInterpolate(cubicNodes, node.x).value).toBeCloseTo(node.y, 12)
    }
  })

  it('exposes basis polynomials that sum to one and satisfy the Kronecker property', () => {
    const result = lagrangeInterpolate(cubicNodes, 1.25)
    const sumOfBasis = result.basis.reduce((acc, b) => acc + b.basisValue, 0)
    expect(sumOfBasis).toBeCloseTo(1, 12)
    const atNode = lagrangeInterpolate(cubicNodes, cubicNodes[2].x)
    // + 0 normalises a signed zero (0 / negative) before the strict comparison
    expect(atNode.basis.map((b) => b.basisValue + 0)).toEqual([0, 0, 1, 0])
    // every basis has n-1 factors, each the ratio of the listed numerator and denominator
    for (const b of result.basis) {
      expect(b.factors).toHaveLength(cubicNodes.length - 1)
      for (const f of b.factors) expect(f.ratio).toBeCloseTo(f.numerator / f.denominator, 14)
      expect(b.term).toBeCloseTo(b.yi * b.basisValue, 14)
    }
  })

  it('estimates an interior missing point of the chapter 3 timeline', () => {
    // nodes (2,28) (3,31) (5,42) (7,48): value at x = 4 worked by hand
    const nodes = [{ x: 2, y: 28 }, { x: 3, y: 31 }, { x: 5, y: 42 }, { x: 7, y: 48 }]
    // L0 = (4-3)(4-5)(4-7)/((2-3)(2-5)(2-7)) = 3/-15 = -0.2
    // L1 = (4-2)(4-5)(4-7)/((3-2)(3-5)(3-7)) = 6/8 = 0.75
    // L2 = (4-2)(4-3)(4-7)/((5-2)(5-3)(5-7)) = -6/-12 = 0.5
    // L3 = (4-2)(4-3)(4-5)/((7-2)(7-3)(7-5)) = -2/40 = -0.05
    const expected = 28 * -0.2 + 31 * 0.75 + 42 * 0.5 + 48 * -0.05
    const result = lagrangeInterpolate(nodes, 4)
    expect(result.basis.map((b) => b.basisValue)).toEqual(
      [-0.2, 0.75, 0.5, -0.05].map((v) => expect.closeTo(v, 12)),
    )
    expect(result.value).toBeCloseTo(expected, 12)
  })

  it('rejects extrapolation outside the node range', () => {
    expectError(() => lagrangeInterpolate(cubicNodes, 3.6), 'EXTRAPOLATION')
    expectError(() => lagrangeInterpolate(cubicNodes, -1.01), 'EXTRAPOLATION')
  })

  it('rejects polynomial degrees above the stability cap', () => {
    const many = Array.from({ length: MAX_POLYNOMIAL_NODES + 1 }, (_, i) => ({ x: i, y: i }))
    expectError(() => lagrangeInterpolate(many, 2.5), 'DEGREE_TOO_HIGH')
  })

  it('handles unevenly spaced nodes', () => {
    const quad = (x: number) => 0.5 * x * x - x + 3
    const nodes = [0, 0.3, 2.9, 7].map((x) => ({ x, y: quad(x) }))
    expect(lagrangeInterpolate(nodes, 5.1).value).toBeCloseTo(quad(5.1), 10)
  })

  it('provides a callable polynomial for plotting', () => {
    const p = lagrangePolynomial(cubicNodes)
    expect(p(1)).toBeCloseTo(cubic(1), 10)
  })
})

describe('Newton divided differences', () => {
  it('builds the divided-difference table', () => {
    const nodes = [{ x: 1, y: 1 }, { x: 2, y: 4 }, { x: 4, y: 16 }, { x: 5, y: 25 }] // y = x^2
    const table = dividedDifferenceTable(nodes)
    expect(table[0]).toEqual([1, 4, 16, 25])
    expect(table[1]).toEqual([3, 6, 9]) // (4-1)/1, (16-4)/2, (25-16)/1
    expect(table[2]).toEqual([1, 1]) // (6-3)/(4-1), (9-6)/(5-2)
    expect(table[3]).toEqual([0]) // (1-1)/(5-1)
  })

  it('evaluates the Newton form with nested multiplication', () => {
    const result = newtonInterpolate(cubicNodes, 1.25)
    expect(result.value).toBeCloseTo(cubic(1.25), 10)
    expect(result.coefficients).toEqual(result.table.map((column) => column[0]))
    // the last nested step carries the final value
    expect(result.nested.at(-1)!.accumulated).toBeCloseTo(result.value, 14)
  })

  it('agrees with Lagrange for identical nodes', () => {
    const nodes = [{ x: 0, y: 21.4 }, { x: 1.2, y: 26.1 }, { x: 2, y: 23.9 }, { x: 3.7, y: 31.5 }, { x: 5, y: 29.2 }]
    for (const x of [0.4, 1.9, 2.5, 4.1]) {
      expect(newtonInterpolate(nodes, x).value).toBeCloseTo(lagrangeInterpolate(nodes, x).value, 10)
    }
    const p = newtonPolynomial(nodes)
    expect(p(3)).toBeCloseTo(lagrangePolynomial(nodes)(3), 10)
  })

  it('applies the same validation rules', () => {
    expectError(() => newtonInterpolate([{ x: 1, y: 1 }, { x: 1, y: 2 }], 1), 'DUPLICATE_NODES')
    expectError(() => newtonInterpolate(cubicNodes, 10), 'EXTRAPOLATION')
  })
})

describe('natural cubic spline', () => {
  const nodes = [
    { x: 0, y: 24 },
    { x: 1, y: 28 },
    { x: 2.5, y: 31 },
    { x: 3, y: 39 },
    { x: 5, y: 42 },
    { x: 6.2, y: 44 },
    { x: 8, y: 48 },
  ]
  const spline = buildNaturalCubicSpline(nodes)

  it('interpolates every node', () => {
    for (const node of nodes) expect(spline.evaluate(node.x)).toBeCloseTo(node.y, 12)
  })

  it('has continuous first and second derivatives at interior knots', () => {
    for (let i = 1; i < spline.segments.length; i++) {
      const left = spline.segments[i - 1]
      const right = spline.segments[i]
      const h = left.x1 - left.x0
      const leftD1 = left.b + 2 * left.c * h + 3 * left.d * h * h
      const leftD2 = 2 * left.c + 6 * left.d * h
      const leftValue = left.a + left.b * h + left.c * h * h + left.d * h ** 3
      expect(leftValue).toBeCloseTo(right.a, 10)
      expect(leftD1).toBeCloseTo(right.b, 10)
      expect(leftD2).toBeCloseTo(2 * right.c, 10)
    }
  })

  it('satisfies natural boundary conditions S″ = 0 at both ends', () => {
    expect(spline.secondDerivatives[0]).toBe(0)
    expect(spline.secondDerivatives.at(-1)).toBe(0)
    expect(spline.derivative(nodes[0].x, 2)).toBeCloseTo(0, 12)
    expect(spline.derivative(nodes.at(-1)!.x, 2)).toBeCloseTo(0, 12)
  })

  it('reproduces a straight line exactly', () => {
    const line = [0, 1, 3, 4.5, 6].map((x) => ({ x, y: 3 * x + 2 }))
    const s = buildNaturalCubicSpline(line)
    expect(s.evaluate(2.2)).toBeCloseTo(8.6, 12)
    expect(s.secondDerivatives.every((m) => Math.abs(m) < 1e-12)).toBe(true)
  })

  it('reports the interval, local coordinate and terms used for an estimate', () => {
    const result = splineInterpolate(nodes, 4)
    expect(result.segmentIndex).toBe(3)
    expect(result.t).toBeCloseTo(1, 14)
    const seg = result.segment
    expect(result.value).toBeCloseTo(seg.a + seg.b + seg.c + seg.d, 12)
  })

  it('solves the tridiagonal system it reports', () => {
    const { system, secondDerivatives: m } = spline
    system.diagonal.forEach((diag, row) => {
      const k = row + 1
      const lhs = (system.lower[row] ?? 0) * m[k - 1] + diag * m[k] + (system.upper[row] ?? 0) * m[k + 1]
      expect(lhs).toBeCloseTo(system.rhs[row], 10)
    })
  })

  it('degenerates to linear interpolation for two nodes and rejects extrapolation', () => {
    const s = buildNaturalCubicSpline([{ x: 0, y: 10 }, { x: 2, y: 20 }])
    expect(s.evaluate(0.5)).toBeCloseTo(12.5, 12)
    expectError(() => splineInterpolate(nodes, -0.1), 'EXTRAPOLATION')
  })
})

describe('node selection', () => {
  const known = [0, 1, 2, 3, 6, 7, 9, 12].map((x) => ({ x, y: x * 2 }))

  it('picks the nearest nodes and always brackets the target', () => {
    const nodes = selectNodesAround(known, 4.5, 4)
    expect(nodes.map((p) => p.x)).toEqual([2, 3, 6, 7])
    const edge = selectNodesAround(known, 0.5, 4)
    expect(edge.map((p) => p.x)).toEqual([0, 1, 2, 3])
  })

  it('returns all available nodes when fewer exist than requested', () => {
    expect(selectNodesAround(known.slice(0, 3), 1.5, 6)).toHaveLength(3)
  })

  it('rejects targets that cannot be bracketed', () => {
    expectError(() => selectNodesAround(known, 13, 4), 'EXTRAPOLATION')
    expectError(() => selectNodesAround(known, -1, 4), 'EXTRAPOLATION')
  })
})
