import type { CompleteSeries, GeneratorConfig } from '../../types/measurement'
import { createRng, gaussian } from '../random'

export const GENERATOR_LIMITS = {
  sampleCount: { min: 12, max: 240 },
  latency: { min: 1, max: 1000 },
  minimumSpanMs: 5,
} as const

export const DEFAULT_GENERATOR: GeneratorConfig = {
  sampleCount: 48,
  minLatencyMs: 18,
  maxLatencyMs: 72,
  seed: 2026,
  irregularSampling: false,
}

export function validateGeneratorConfig(config: GeneratorConfig): string[] {
  const issues: string[] = []
  const { sampleCount, minLatencyMs, maxLatencyMs, seed } = config
  if (!Number.isInteger(sampleCount) || sampleCount < GENERATOR_LIMITS.sampleCount.min || sampleCount > GENERATOR_LIMITS.sampleCount.max) {
    issues.push(`Sample count must be a whole number from ${GENERATOR_LIMITS.sampleCount.min} to ${GENERATOR_LIMITS.sampleCount.max}.`)
  }
  if (!Number.isFinite(minLatencyMs) || !Number.isFinite(maxLatencyMs)) {
    issues.push('Latency range must be numeric.')
  } else {
    if (minLatencyMs < GENERATOR_LIMITS.latency.min || maxLatencyMs > GENERATOR_LIMITS.latency.max) {
      issues.push(`Latency must stay between ${GENERATOR_LIMITS.latency.min} and ${GENERATOR_LIMITS.latency.max} ms.`)
    }
    if (maxLatencyMs - minLatencyMs < GENERATOR_LIMITS.minimumSpanMs) {
      issues.push(`Maximum latency must exceed the minimum by at least ${GENERATOR_LIMITS.minimumSpanMs} ms.`)
    }
  }
  if (!Number.isInteger(seed) || seed < 0) issues.push('Seed must be a non-negative whole number.')
  return issues
}

/**
 * Synthetic RTT series with the structure real monitors show:
 *  - a slow wave (daily-style load cycle) plus a faster ripple,
 *  - AR(1)-correlated jitter (consecutive probes resemble each other),
 *  - one to three congestion episodes that lift latency smoothly for a few samples.
 * Values are clamped to the configured range and rounded to 0.1 ms, like ping output.
 * Probes are one second apart; with irregular sampling each time is jittered.
 */
export function generateLatencySeries(config: GeneratorConfig): CompleteSeries {
  const issues = validateGeneratorConfig(config)
  if (issues.length > 0) throw new Error(issues.join(' '))

  const rng = createRng(config.seed)
  const { sampleCount: n, minLatencyMs: lo, maxLatencyMs: hi } = config
  const span = hi - lo

  const slowPeriod = n * (0.8 + rng() * 0.6)
  const slowPhase = rng() * Math.PI * 2
  const fastPeriod = 6 + rng() * 6
  const fastPhase = rng() * Math.PI * 2
  const episodes = Array.from({ length: 1 + Math.floor(rng() * 3) }, () => ({
    centre: n * (0.15 + rng() * 0.7),
    width: 1.5 + rng() * 2.5,
    height: 0.18 + rng() * 0.22,
  }))

  const timestamps: number[] = []
  const pingMs: number[] = []
  let jitter = 0
  for (let i = 0; i < n; i++) {
    const offset = config.irregularSampling && i > 0 && i < n - 1 ? (rng() - 0.5) * 0.7 : 0
    const t = i + offset
    jitter = 0.65 * jitter + 0.35 * gaussian(rng)
    const congestion = episodes.reduce((sum, e) => sum + e.height * Math.exp(-(((t - e.centre) / e.width) ** 2)), 0)
    const shape =
      0.38 +
      0.16 * Math.sin((2 * Math.PI * t) / slowPeriod + slowPhase) +
      0.05 * Math.sin((2 * Math.PI * t) / fastPeriod + fastPhase) +
      congestion +
      0.045 * jitter
    const value = Math.min(hi, Math.max(lo, lo + span * shape))
    timestamps.push(Math.round(t * 1000) / 1000)
    pingMs.push(Math.round(value * 10) / 10)
  }
  return { timestamps, pingMs }
}
