import type { DatasetBundle, DatasetSource, GroundTruth, MaskConfig, Measurement, ObservedDataset } from '../../types/measurement'
import { createRng, randomInt } from '../random'

export const MASK_LIMITS = { minPercent: 0, maxPercent: 50, minKnown: 5 } as const

export const DEFAULT_MASK: MaskConfig = { missingPercent: 18, pattern: 'random', seed: 7 }

/**
 * Picks which records disappear. The first and last records always stay observed,
 * because a value outside the known range would need extrapolation, not interpolation.
 *
 * - random: positions drawn uniformly from the interior, without replacement.
 * - consecutive: bursts of 2–4 adjacent records, separated by at least one observed record.
 */
export function generateMissingIndices(sampleCount: number, config: MaskConfig): number[] {
  const interior = Math.max(0, sampleCount - 2)
  const maxMissing = Math.max(0, sampleCount - MASK_LIMITS.minKnown)
  const percent = Math.min(MASK_LIMITS.maxPercent, Math.max(MASK_LIMITS.minPercent, config.missingPercent))
  const target = Math.min(maxMissing, interior, Math.round((sampleCount * percent) / 100))
  if (target === 0) return []

  const rng = createRng(config.seed)
  const missing = new Set<number>()

  if (config.pattern === 'random') {
    const pool = Array.from({ length: interior }, (_, k) => k + 1)
    for (let k = 0; k < target; k++) {
      const pick = randomInt(rng, k, pool.length - 1)
      ;[pool[k], pool[pick]] = [pool[pick], pool[k]]
      missing.add(pool[k])
    }
  } else {
    let attempts = 0
    while (missing.size < target && attempts < 500) {
      attempts++
      const length = Math.min(randomInt(rng, 2, 4), target - missing.size)
      const start = randomInt(rng, 1, sampleCount - 1 - length)
      let free = true
      // keep one observed record on each side of the burst
      for (let i = start - 1; i <= start + length; i++) if (missing.has(i)) free = false
      if (!free) continue
      for (let i = start; i < start + length; i++) missing.add(i)
    }
  }
  return [...missing].sort((a, b) => a - b)
}

/**
 * Splits a complete series into the observed dataset and the sealed ground truth.
 * The observed rows for masked indices carry `observedPingMs: null` — the true value is
 * copied only into `GroundTruth`.
 */
export function applyMask(
  timestamps: readonly number[],
  values: readonly (number | null)[],
  missingIndices: readonly number[],
  label: string,
): { observed: ObservedDataset; groundTruth: GroundTruth } {
  const masked = new Set(missingIndices)
  const truth = new Map<number, number>()
  const measurements: Measurement[] = timestamps.map((timestamp, index) => {
    const value = values[index]
    if (value !== null) truth.set(index, value)
    const hidden = masked.has(index) || value === null
    return Object.freeze({
      index,
      timestamp,
      observedPingMs: hidden ? null : value,
      reconstructedPingMs: null,
      status: hidden ? 'missing' : 'observed',
    } satisfies Measurement)
  })
  return {
    observed: Object.freeze({ kind: 'observed', label, measurements: Object.freeze(measurements) }),
    groundTruth: Object.freeze({ kind: 'ground-truth', values: truth }),
  }
}

export function buildBundle(
  source: DatasetSource,
  timestamps: readonly number[],
  values: readonly (number | null)[],
  maskIndices: readonly number[],
  label: string,
): DatasetBundle {
  const { observed, groundTruth } = applyMask(timestamps, values, maskIndices, label)
  const missingIndices = observed.measurements.filter((m) => m.status === 'missing').map((m) => m.index)
  return { source, observed, groundTruth, missingIndices }
}
