import type { InterpolationMethod, MethodResult, Point } from './interpolation'

export type MeasurementStatus = 'observed' | 'missing' | 'reconstructed'

/**
 * One row of the series as the reconstruction pipeline sees it.
 *
 * There is deliberately no `actualPingMs` field: the true value of a missing record lives
 * only in `GroundTruth`, which the pipeline never receives.
 */
export interface Measurement {
  readonly index: number
  /** seconds since the first probe */
  readonly timestamp: number
  readonly observedPingMs: number | null
  readonly reconstructedPingMs: number | null
  readonly status: MeasurementStatus
}

/** The incomplete dataset: the only input interpolation is allowed to read. */
export interface ObservedDataset {
  readonly kind: 'observed'
  readonly label: string
  readonly measurements: readonly Measurement[]
}

/**
 * Validation-only reference values keyed by measurement index.
 * Synthetic data has a value for every index; a CSV only for rows that contained one.
 */
export interface GroundTruth {
  readonly kind: 'ground-truth'
  readonly values: ReadonlyMap<number, number>
}

export interface GeneratorConfig {
  readonly sampleCount: number
  readonly minLatencyMs: number
  readonly maxLatencyMs: number
  readonly seed: number
  /** jitter probe times by up to ±35 % of the interval */
  readonly irregularSampling: boolean
}

export type MissingPattern = 'random' | 'consecutive'

export interface MaskConfig {
  readonly missingPercent: number
  readonly pattern: MissingPattern
  readonly seed: number
}

export interface CompleteSeries {
  readonly timestamps: readonly number[]
  readonly pingMs: readonly number[]
}

export type DatasetSource =
  | { readonly type: 'synthetic'; readonly generator: GeneratorConfig; readonly mask: MaskConfig }
  | { readonly type: 'csv'; readonly fileName: string }

/** Everything the app holds about the active dataset. Only `observed` reaches the algorithms. */
export interface DatasetBundle {
  readonly source: DatasetSource
  readonly observed: ObservedDataset
  readonly groundTruth: GroundTruth
  /** indices of records that are missing in `observed` */
  readonly missingIndices: readonly number[]
}

export interface ReconstructionOptions {
  readonly method: InterpolationMethod
  /** nodes used by the local Lagrange/Newton polynomial (degree = nodeCount − 1) */
  readonly nodeCount: number
}

export type ReconstructionOutcome =
  | {
      readonly ok: true
      readonly index: number
      readonly timestamp: number
      readonly value: number
      readonly method: InterpolationMethod
      readonly nodes: readonly Point[]
      readonly detail: MethodResult
    }
  | {
      readonly ok: false
      readonly index: number
      readonly timestamp: number
      readonly method: InterpolationMethod
      readonly reason: string
    }
