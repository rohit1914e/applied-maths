import type { LagrangeBasisStep, LagrangeResult, Point } from '../../types/interpolation'
import { assertPolynomialSize, assertWithinDomain, validateNodes } from '../shared/validation'

/**
 * Lagrange form of the interpolating polynomial:
 *
 *   P(x) = Σ_i y_i · L_i(x),   L_i(x) = Π_{j≠i} (x − x_j) / (x_i − x_j)
 *
 * Every factor is kept so the UI can show the substitution step by step.
 */
export function lagrangeInterpolate(nodes: readonly Point[], x: number): LagrangeResult {
  const sorted = validateNodes(nodes, 2)
  assertPolynomialSize(sorted)
  assertWithinDomain(x, sorted)

  const basis: LagrangeBasisStep[] = sorted.map((node, i) => {
    const factors = sorted.flatMap((other, j) => {
      if (j === i) return []
      const numerator = x - other.x
      const denominator = node.x - other.x // non-zero: duplicates rejected above
      return [{ j, xj: other.x, numerator, denominator, ratio: numerator / denominator }]
    })
    const basisValue = factors.reduce((product, f) => product * f.ratio, 1)
    return { i, xi: node.x, yi: node.y, factors, basisValue, term: node.y * basisValue }
  })

  const value = basis.reduce((sum, b) => sum + b.term, 0)
  return { method: 'lagrange', x, value, nodes: sorted, basis }
}

/** Returns P(x) as a function, for drawing the curve between the first and last node. */
export function lagrangePolynomial(nodes: readonly Point[]): (x: number) => number {
  const sorted = validateNodes(nodes, 2)
  assertPolynomialSize(sorted)
  return (x: number) => {
    let sum = 0
    for (let i = 0; i < sorted.length; i++) {
      let basis = 1
      for (let j = 0; j < sorted.length; j++) {
        if (j !== i) basis *= (x - sorted[j].x) / (sorted[i].x - sorted[j].x)
      }
      sum += sorted[i].y * basis
    }
    return sum
  }
}
