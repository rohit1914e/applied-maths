import type { NestedStep, NewtonResult, Point } from '../../types/interpolation'
import { assertPolynomialSize, assertWithinDomain, validateNodes } from '../shared/validation'

/**
 * Divided-difference table.
 *
 *   table[0][i] = f[x_i] = y_i
 *   table[k][i] = (table[k−1][i+1] − table[k−1][i]) / (x_{i+k} − x_i)
 *
 * Expects nodes already validated and sorted (or validates them itself).
 */
export function dividedDifferenceTable(nodes: readonly Point[]): number[][] {
  const sorted = validateNodes(nodes, 1)
  const n = sorted.length
  const table: number[][] = [sorted.map((p) => p.y)]
  for (let k = 1; k < n; k++) {
    const previous = table[k - 1]
    const column: number[] = []
    for (let i = 0; i < n - k; i++) {
      column.push((previous[i + 1] - previous[i]) / (sorted[i + k].x - sorted[i].x))
    }
    table.push(column)
  }
  return table
}

/**
 * Newton form:  P(x) = a_0 + a_1 (x − x_0) + a_2 (x − x_0)(x − x_1) + …
 * with a_k = f[x_0, …, x_k], evaluated by nested multiplication:
 *
 *   b_n = a_n,   b_k = a_k + (x − x_k) · b_{k+1},   P(x) = b_0
 */
export function newtonInterpolate(nodes: readonly Point[], x: number): NewtonResult {
  const sorted = validateNodes(nodes, 2)
  assertPolynomialSize(sorted)
  assertWithinDomain(x, sorted)

  const table = dividedDifferenceTable(sorted)
  const coefficients = table.map((column) => column[0])
  const n = coefficients.length

  const nested: NestedStep[] = []
  let accumulated = coefficients[n - 1]
  nested.push({ k: n - 1, coefficient: coefficients[n - 1], multiplier: null, accumulated })
  for (let k = n - 2; k >= 0; k--) {
    const multiplier = x - sorted[k].x
    accumulated = coefficients[k] + multiplier * accumulated
    nested.push({ k, coefficient: coefficients[k], multiplier, accumulated })
  }

  return { method: 'newton', x, value: accumulated, nodes: sorted, table, coefficients, nested }
}

export function newtonPolynomial(nodes: readonly Point[]): (x: number) => number {
  const sorted = validateNodes(nodes, 2)
  assertPolynomialSize(sorted)
  const coefficients = dividedDifferenceTable(sorted).map((column) => column[0])
  return (x: number) => {
    let acc = coefficients[coefficients.length - 1]
    for (let k = coefficients.length - 2; k >= 0; k--) acc = coefficients[k] + (x - sorted[k].x) * acc
    return acc
  }
}

/**
 * The Newton polynomial truncated after term k:
 *   P_k(x) = a_0 + a_1(x − x_0) + … + a_k(x − x_0)…(x − x_{k−1})
 * P_k interpolates the first k+1 nodes; P_n is the full polynomial. Used to show the
 * polynomial being built one divided difference at a time.
 */
export function newtonPartialPolynomial(nodes: readonly Point[], k: number): (x: number) => number {
  const sorted = validateNodes(nodes, 1)
  assertPolynomialSize(sorted)
  const coefficients = dividedDifferenceTable(sorted).map((column) => column[0])
  const last = Math.min(Math.max(0, Math.floor(k)), coefficients.length - 1)
  return (x: number) => {
    let acc = coefficients[last]
    for (let j = last - 1; j >= 0; j--) acc = coefficients[j] + (x - sorted[j].x) * acc
    return acc
  }
}
