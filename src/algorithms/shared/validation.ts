import type { Point } from '../../types/interpolation'

/**
 * Numerical tolerances (documented in docs/ALGORITHM_IMPLEMENTATION.md).
 *
 * Two x-coordinates are treated as the same node when they differ by less than
 * `NODE_ABSOLUTE + NODE_RELATIVE · max(|a|, |b|)`. Such a pair would make a Lagrange
 * denominator (x_i − x_j) or a spline interval h_i effectively zero.
 *
 * A query point may sit outside the node range by at most `DOMAIN` (scaled the same way)
 * before it counts as extrapolation; this absorbs floating-point noise at the end nodes.
 */
export const TOLERANCE = {
  NODE_ABSOLUTE: 1e-12,
  NODE_RELATIVE: 1e-9,
  DOMAIN: 1e-9,
} as const

/**
 * Global polynomial interpolation through many equally weighted samples oscillates
 * between nodes (Runge's phenomenon) and the Lagrange/Newton arithmetic loses precision.
 * We cap the polynomial at 10 nodes (degree 9); the app defaults to 4 (cubic).
 */
export const MAX_POLYNOMIAL_NODES = 10

export type InterpolationErrorCode =
  | 'DUPLICATE_NODES'
  | 'INSUFFICIENT_NODES'
  | 'EXTRAPOLATION'
  | 'NON_FINITE'
  | 'DEGREE_TOO_HIGH'

export class InterpolationError extends Error {
  readonly code: InterpolationErrorCode

  constructor(code: InterpolationErrorCode, message: string) {
    super(message)
    this.name = 'InterpolationError'
    this.code = code
  }
}

export function sameNode(a: number, b: number): boolean {
  const scale = Math.max(Math.abs(a), Math.abs(b))
  return Math.abs(a - b) <= TOLERANCE.NODE_ABSOLUTE + TOLERANCE.NODE_RELATIVE * scale
}

/** Validates interpolation nodes and returns a new array sorted by x. */
export function validateNodes(nodes: readonly Point[], minimum: number): Point[] {
  if (nodes.length < minimum) {
    throw new InterpolationError(
      'INSUFFICIENT_NODES',
      `At least ${minimum} known measurements are required; received ${nodes.length}.`,
    )
  }
  for (const node of nodes) {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
      throw new InterpolationError('NON_FINITE', `Node (${node.x}, ${node.y}) is not a finite number.`)
    }
  }
  const sorted = [...nodes].sort((a, b) => a.x - b.x)
  for (let i = 1; i < sorted.length; i++) {
    if (sameNode(sorted[i - 1].x, sorted[i].x)) {
      throw new InterpolationError(
        'DUPLICATE_NODES',
        `Two measurements share the timestamp x = ${sorted[i].x}. Interpolation nodes must be distinct.`,
      )
    }
  }
  return sorted
}

export function assertWithinDomain(x: number, sortedNodes: readonly Point[]): void {
  if (!Number.isFinite(x)) {
    throw new InterpolationError('NON_FINITE', `Query point ${x} is not a finite number.`)
  }
  const lo = sortedNodes[0].x
  const hi = sortedNodes[sortedNodes.length - 1].x
  const slack = TOLERANCE.DOMAIN * Math.max(1, Math.abs(lo), Math.abs(hi))
  if (x < lo - slack || x > hi + slack) {
    throw new InterpolationError(
      'EXTRAPOLATION',
      `x = ${x} lies outside the node range [${lo}, ${hi}]. Extrapolation is not supported.`,
    )
  }
}

export function assertPolynomialSize(nodes: readonly Point[]): void {
  if (nodes.length > MAX_POLYNOMIAL_NODES) {
    throw new InterpolationError(
      'DEGREE_TOO_HIGH',
      `A polynomial through ${nodes.length} nodes (degree ${nodes.length - 1}) is numerically unstable. ` +
        `Use at most ${MAX_POLYNOMIAL_NODES} nodes or the cubic spline.`,
    )
  }
}
