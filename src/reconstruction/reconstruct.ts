import { lagrangeInterpolate, lagrangePolynomial } from '../algorithms/lagrange/lagrange'
import { newtonInterpolate, newtonPolynomial } from '../algorithms/newton/newton'
import { buildNaturalCubicSpline, splineInterpolate } from '../algorithms/cubicSpline/naturalCubicSpline'
import { selectNodesAround } from '../algorithms/nodeSelection'
import { InterpolationError, MAX_POLYNOMIAL_NODES } from '../algorithms/shared/validation'
import type { NaturalCubicSpline, Point } from '../types/interpolation'
import type { Measurement, ObservedDataset, ReconstructionOptions, ReconstructionOutcome } from '../types/measurement'

export const DEFAULT_NODE_COUNT = 4
export const NODE_COUNT_RANGE = { min: 2, max: MAX_POLYNOMIAL_NODES } as const

/**
 * Known points for interpolation: observed records only. Reconstructed values are never fed
 * back in as nodes, so one estimate cannot contaminate the next.
 */
export function knownPoints(observed: ObservedDataset): Point[] {
  return observed.measurements
    .filter((m) => m.status === 'observed' && m.observedPingMs !== null)
    .map((m) => ({ x: m.timestamp, y: m.observedPingMs as number }))
}

/**
 * Reconstructs one or more missing records. The function signature is the isolation
 * boundary: it receives only the ObservedDataset, never the ground truth.
 */
export function reconstruct(
  observed: ObservedDataset,
  indices: readonly number[],
  options: ReconstructionOptions,
): ReconstructionOutcome[] {
  const known = knownPoints(observed)
  let spline: NaturalCubicSpline | null = null
  let splineError: string | null = null
  if (options.method === 'spline') {
    try {
      spline = buildNaturalCubicSpline(known)
    } catch (error) {
      splineError = messageOf(error)
    }
  }

  return indices.map((index) => {
    const measurement = observed.measurements[index]
    if (!measurement) throw new RangeError(`No measurement at index ${index}.`)
    const base = { index, timestamp: measurement.timestamp, method: options.method }
    if (measurement.status === 'observed') {
      return { ...base, ok: false, reason: 'This record was observed; there is nothing to reconstruct.' }
    }
    const x = measurement.timestamp
    try {
      if (options.method === 'spline') {
        if (!spline) return { ...base, ok: false, reason: splineError ?? 'Spline could not be built.' }
        const detail = splineInterpolate(known, x, spline)
        return { ...base, ok: true, value: detail.value, nodes: spline.nodes, detail }
      }
      const nodes = selectNodesAround(known, x, clampNodeCount(options.nodeCount))
      const detail = options.method === 'lagrange' ? lagrangeInterpolate(nodes, x) : newtonInterpolate(nodes, x)
      return { ...base, ok: true, value: detail.value, nodes: detail.nodes, detail }
    } catch (error) {
      if (error instanceof InterpolationError) return { ...base, ok: false, reason: error.message }
      throw error
    }
  })
}

export function clampNodeCount(count: number): number {
  return Math.min(NODE_COUNT_RANGE.max, Math.max(NODE_COUNT_RANGE.min, Math.round(count)))
}

/** Samples the interpolant used for one outcome, for drawing its curve. */
export function sampleCurve(outcome: ReconstructionOutcome, samples = 160): Point[] {
  if (!outcome.ok) return []
  const detail = outcome.detail
  const f =
    detail.method === 'spline'
      ? detail.spline.evaluate
      : detail.method === 'lagrange'
        ? lagrangePolynomial(detail.nodes)
        : newtonPolynomial(detail.nodes)
  const lo = detail.nodes[0].x
  const hi = detail.nodes[detail.nodes.length - 1].x
  return Array.from({ length: samples + 1 }, (_, k) => {
    const x = lo + ((hi - lo) * k) / samples
    return { x, y: f(Math.min(hi, x)) }
  })
}

/** Produces the series with reconstructed values merged in (status "reconstructed"). */
export function mergeReconstructions(
  observed: ObservedDataset,
  outcomes: ReadonlyMap<number, ReconstructionOutcome>,
): Measurement[] {
  return observed.measurements.map((m) => {
    const outcome = outcomes.get(m.index)
    if (m.status !== 'missing' || !outcome?.ok) return m
    return { ...m, reconstructedPingMs: outcome.value, status: 'reconstructed' }
  })
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
