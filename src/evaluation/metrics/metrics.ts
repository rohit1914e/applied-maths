export interface ComparisonPair {
  readonly actual: number
  readonly estimate: number
}

export interface ErrorMetrics {
  readonly n: number
  /** (1/n) Σ |y_i − ŷ_i| */
  readonly mae: number
  /** sqrt((1/n) Σ (y_i − ŷ_i)²) */
  readonly rmse: number
  /** max |y_i − ŷ_i| */
  readonly maxAbsError: number
  /** position in the input of the largest error */
  readonly maxAbsErrorAt: number
}

export class EvaluationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EvaluationError'
  }
}

export function computeErrorMetrics(pairs: readonly ComparisonPair[]): ErrorMetrics {
  if (pairs.length === 0) {
    throw new EvaluationError('No comparison pairs: at least one hidden known value must be reconstructed.')
  }
  let absSum = 0
  let squareSum = 0
  let maxAbsError = -Infinity
  let maxAbsErrorAt = -1
  pairs.forEach(({ actual, estimate }, i) => {
    if (!Number.isFinite(actual) || !Number.isFinite(estimate)) {
      throw new EvaluationError(`Pair ${i} is not finite (actual ${actual}, estimate ${estimate}).`)
    }
    const abs = Math.abs(actual - estimate)
    absSum += abs
    squareSum += abs * abs
    if (abs > maxAbsError) {
      maxAbsError = abs
      maxAbsErrorAt = i
    }
  })
  const n = pairs.length
  return { n, mae: absSum / n, rmse: Math.sqrt(squareSum / n), maxAbsError, maxAbsErrorAt }
}
