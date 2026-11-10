import { reconstruct } from '../../reconstruction/reconstruct'
import { applyMask } from '../../simulation/missingData/missingData'
import { createRng } from '../../simulation/random'
import { METHODS, type InterpolationMethod } from '../../types/interpolation'
import type { DatasetBundle } from '../../types/measurement'
import { computeErrorMetrics, type ErrorMetrics } from '../metrics/metrics'

/** Fully known series used as the reference for an artificial-masking experiment. */
export interface ReferenceSeries {
  /** original dataset index of each reference point */
  readonly sourceIndices: readonly number[]
  readonly timestamps: readonly number[]
  readonly values: readonly number[]
}

export interface EvaluationRow {
  readonly sourceIndex: number
  readonly timestamp: number
  readonly actual: number
  readonly estimate: number | null
  readonly absError: number | null
  readonly failure: string | null
}

export interface MethodEvaluation {
  readonly method: InterpolationMethod
  readonly rows: readonly EvaluationRow[]
  readonly metrics: ErrorMetrics | null
  readonly failures: number
}

export interface AccuracyExperiment {
  readonly reference: ReferenceSeries
  /** positions within the reference that were hidden */
  readonly hiddenPositions: readonly number[]
  readonly results: readonly MethodEvaluation[]
  /** method with the lowest RMSE among those that produced metrics (first in METHODS order on a tie) */
  readonly bestByRmse: InterpolationMethod | null
  /** every method whose RMSE equals the best within floating-point tolerance */
  readonly tiedBest: readonly InterpolationMethod[]
}

/** RMSEs closer than this (relative) are the same result up to rounding, e.g. Lagrange vs Newton. */
export const RMSE_TIE_TOLERANCE = 1e-9

const sameRmse = (a: number, b: number) => Math.abs(a - b) <= RMSE_TIE_TOLERANCE * Math.max(1, Math.abs(a))

/** Methods with metrics, lowest RMSE first; ties keep METHODS order (the sort is stable). */
export function rankByRmse(results: readonly MethodEvaluation[]): MethodEvaluation[] {
  return results
    .filter((r) => r.metrics)
    .sort((a, b) => (sameRmse(a.metrics!.rmse, b.metrics!.rmse) ? 0 : a.metrics!.rmse - b.metrics!.rmse))
}

/**
 * Builds the reference and the hidden set for the active dataset.
 *  - Synthetic data: the reference is the complete generated series and the hidden set is
 *    exactly the records masked in chapter 4.
 *  - CSV data: genuinely missing rows have no truth and are excluded. A seeded holdout
 *    of the remaining interior rows is hidden instead.
 */
export function planExperiment(
  bundle: DatasetBundle,
  holdoutPercent: number,
  seed: number,
): { reference: ReferenceSeries; hiddenPositions: number[] } {
  const { measurements } = bundle.observed
  const truth = bundle.groundTruth.values
  const sourceIndices = measurements.map((m) => m.index).filter((i) => truth.has(i))
  const reference: ReferenceSeries = {
    sourceIndices,
    timestamps: sourceIndices.map((i) => measurements[i].timestamp),
    values: sourceIndices.map((i) => truth.get(i) as number),
  }

  if (bundle.source.type === 'synthetic') {
    const hidden = new Set(bundle.missingIndices)
    return { reference, hiddenPositions: sourceIndices.flatMap((src, pos) => (hidden.has(src) ? [pos] : [])) }
  }

  const interior = Array.from({ length: Math.max(0, reference.values.length - 2) }, (_, k) => k + 1)
  const count = Math.min(interior.length, Math.max(1, Math.round((reference.values.length * holdoutPercent) / 100)))
  const rng = createRng(seed)
  for (let k = 0; k < count; k++) {
    const pick = k + Math.floor(rng() * (interior.length - k))
    ;[interior[k], interior[pick]] = [interior[pick], interior[k]]
  }
  return { reference, hiddenPositions: interior.slice(0, count).sort((a, b) => a - b) }
}

/**
 * The artificial-masking procedure:
 *  1. start from a fully known reference series,
 *  2. keep its values aside as ground truth,
 *  3. hide the selected positions,
 *  4. reconstruct them from the observed remainder only,
 *  5. compare each estimate with the hidden truth,
 *  6. summarise with MAE, RMSE and maximum absolute error.
 */
export function runAccuracyExperiment(
  reference: ReferenceSeries,
  hiddenPositions: readonly number[],
  nodeCount: number,
  methods: readonly InterpolationMethod[] = METHODS,
): AccuracyExperiment {
  const { observed, groundTruth } = applyMask(reference.timestamps, reference.values, hiddenPositions, 'experiment')

  const results = methods.map((method): MethodEvaluation => {
    // Step 4 sees only `observed`; `groundTruth` is consulted afterwards in step 5.
    const outcomes = reconstruct(observed, hiddenPositions, { method, nodeCount })
    const rows: EvaluationRow[] = outcomes.map((o) => {
      const actual = groundTruth.values.get(o.index) as number
      const base = { sourceIndex: reference.sourceIndices[o.index], timestamp: o.timestamp, actual }
      return o.ok
        ? { ...base, estimate: o.value, absError: Math.abs(actual - o.value), failure: null }
        : { ...base, estimate: null, absError: null, failure: o.reason }
    })
    const pairs = rows.flatMap((r) => (r.estimate === null ? [] : [{ actual: r.actual, estimate: r.estimate }]))
    return {
      method,
      rows,
      metrics: pairs.length > 0 ? computeErrorMetrics(pairs) : null,
      failures: rows.length - pairs.length,
    }
  })

  const ranked = rankByRmse(results)
  const best = ranked[0]
  const tiedBest = best ? ranked.filter((r) => sameRmse(best.metrics!.rmse, r.metrics!.rmse)).map((r) => r.method) : []
  return { reference, hiddenPositions, results, bestByRmse: best?.method ?? null, tiedBest }
}
