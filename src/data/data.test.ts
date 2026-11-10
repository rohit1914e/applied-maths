import { describe, expect, it } from 'vitest'
import { generateLatencySeries, DEFAULT_GENERATOR, validateGeneratorConfig } from '../simulation/datasetGenerator/generateDataset'
import { applyMask, generateMissingIndices } from '../simulation/missingData/missingData'
import { createProbeSimulator } from '../simulation/networkSimulation/simulateProbe'
import { parseLatencyCsv, SAMPLE_CSV } from './csv/parseLatencyCsv'
import { createCsvBundle, createSyntheticBundle } from './datasets'
import { knownPoints, reconstruct, mergeReconstructions, sampleCurve } from '../reconstruction/reconstruct'
import { computeErrorMetrics, EvaluationError } from '../evaluation/metrics/metrics'
import { planExperiment, rankByRmse, runAccuracyExperiment } from '../evaluation/comparison/compareMethods'
import type { DatasetBundle } from '../types/measurement'

describe('synthetic dataset generator', () => {
  it('is deterministic for a seed and changes with the seed', () => {
    const a = generateLatencySeries(DEFAULT_GENERATOR)
    const b = generateLatencySeries(DEFAULT_GENERATOR)
    const c = generateLatencySeries({ ...DEFAULT_GENERATOR, seed: DEFAULT_GENERATOR.seed + 1 })
    expect(a).toEqual(b)
    expect(c.pingMs).not.toEqual(a.pingMs)
  })

  it('respects sample count and latency range', () => {
    const config = { ...DEFAULT_GENERATOR, sampleCount: 120, minLatencyMs: 30, maxLatencyMs: 45 }
    const { timestamps, pingMs } = generateLatencySeries(config)
    expect(pingMs).toHaveLength(120)
    expect(Math.min(...pingMs)).toBeGreaterThanOrEqual(30)
    expect(Math.max(...pingMs)).toBeLessThanOrEqual(45)
    expect(timestamps[0]).toBe(0)
    expect(timestamps[119]).toBe(119)
  })

  it('produces strictly increasing, unevenly spaced timestamps when irregular', () => {
    const { timestamps } = generateLatencySeries({ ...DEFAULT_GENERATOR, irregularSampling: true })
    const gaps = timestamps.slice(1).map((t, i) => t - timestamps[i])
    expect(gaps.every((g) => g > 0)).toBe(true)
    expect(new Set(gaps.map((g) => g.toFixed(3))).size).toBeGreaterThan(5)
  })

  it('validates its configuration', () => {
    expect(validateGeneratorConfig({ ...DEFAULT_GENERATOR, sampleCount: 3 })).toHaveLength(1)
    expect(validateGeneratorConfig({ ...DEFAULT_GENERATOR, minLatencyMs: 50, maxLatencyMs: 52 })).toHaveLength(1)
    expect(() => generateLatencySeries({ ...DEFAULT_GENERATOR, seed: -1 })).toThrow(/Seed/)
  })
})

describe('missing-data masking', () => {
  it('hides the requested share, never the endpoints, deterministically', () => {
    const mask = { missingPercent: 25, pattern: 'random' as const, seed: 3 }
    const indices = generateMissingIndices(40, mask)
    expect(indices).toHaveLength(10)
    expect(indices).not.toContain(0)
    expect(indices).not.toContain(39)
    expect(generateMissingIndices(40, mask)).toEqual(indices)
  })

  it('creates consecutive bursts separated by observed records', () => {
    const indices = generateMissingIndices(60, { missingPercent: 30, pattern: 'consecutive', seed: 11 })
    expect(indices.length).toBe(18)
    const runs: number[] = []
    let run = 1
    for (let i = 1; i < indices.length; i++) {
      if (indices[i] === indices[i - 1] + 1) run++
      else {
        runs.push(run)
        run = 1
        expect(indices[i] - indices[i - 1]).toBeGreaterThanOrEqual(2)
      }
    }
    runs.push(run)
    expect(runs.some((r) => r >= 2)).toBe(true)
    expect(Math.max(...runs)).toBeLessThanOrEqual(4)
  })

  it('keeps hidden values only in the ground truth', () => {
    const { observed, groundTruth } = applyMask([0, 1, 2, 3], [10, 20, 30, 40], [1, 2], 'x')
    expect(observed.measurements.map((m) => m.observedPingMs)).toEqual([10, null, null, 40])
    expect(observed.measurements[1].status).toBe('missing')
    expect(groundTruth.values.get(1)).toBe(20)
    // no property on the observed rows carries the hidden values
    const serialised = JSON.stringify(observed)
    expect(serialised).not.toMatch(/\b20\b|\b30\b/)
  })
})

describe('ground-truth isolation', () => {
  it('reconstruction output does not depend on the hidden values', () => {
    const bundle = createSyntheticBundle()
    const tampered: DatasetBundle = {
      ...bundle,
      groundTruth: { kind: 'ground-truth', values: new Map([...bundle.groundTruth.values].map(([k]) => [k, -999])) },
    }
    for (const method of ['lagrange', 'newton', 'spline'] as const) {
      const a = reconstruct(bundle.observed, bundle.missingIndices, { method, nodeCount: 4 })
      const b = reconstruct(tampered.observed, tampered.missingIndices, { method, nodeCount: 4 })
      expect(a.map((o) => (o.ok ? o.value : o.reason))).toEqual(b.map((o) => (o.ok ? o.value : o.reason)))
    }
  })

  it('only observed records become interpolation nodes', () => {
    const bundle = createSyntheticBundle()
    const nodes = knownPoints(bundle.observed)
    const missingTimes = new Set(bundle.missingIndices.map((i) => bundle.observed.measurements[i].timestamp))
    expect(nodes.some((p) => missingTimes.has(p.x))).toBe(false)
    expect(nodes).toHaveLength(bundle.observed.measurements.length - bundle.missingIndices.length)
  })
})

describe('reconstruction pipeline', () => {
  const bundle = createSyntheticBundle()

  it('reconstructs every interior gap with each method', () => {
    for (const method of ['lagrange', 'newton', 'spline'] as const) {
      const outcomes = reconstruct(bundle.observed, bundle.missingIndices, { method, nodeCount: 4 })
      expect(outcomes.every((o) => o.ok)).toBe(true)
    }
  })

  it('gives identical Lagrange and Newton estimates for the same node window', () => {
    const l = reconstruct(bundle.observed, bundle.missingIndices, { method: 'lagrange', nodeCount: 5 })
    const n = reconstruct(bundle.observed, bundle.missingIndices, { method: 'newton', nodeCount: 5 })
    l.forEach((o, i) => {
      const other = n[i]
      if (!o.ok || !other.ok) throw new Error('expected success')
      expect(other.nodes).toEqual(o.nodes)
      expect(other.value).toBeCloseTo(o.value, 8)
    })
  })

  it('refuses observed records and endpoints that would need extrapolation', () => {
    const csv = parseLatencyCsv('timestamp,ping_ms\n0,\n1,20\n2,22\n3,\n4,25\n5,27\n')
    if (!csv.ok) throw new Error('expected valid csv')
    const csvBundle = createCsvBundle('edge.csv', csv.rows)
    const [first, inner] = reconstruct(csvBundle.observed, [0, 3], { method: 'spline', nodeCount: 4 })
    expect(first.ok).toBe(false)
    expect(inner.ok).toBe(true)
    const [observedRow] = reconstruct(csvBundle.observed, [1], { method: 'lagrange', nodeCount: 4 })
    expect(observedRow.ok).toBe(false)
  })

  it('merges reconstructed values with status "reconstructed" and samples a curve within the node span', () => {
    const outcomes = reconstruct(bundle.observed, bundle.missingIndices, { method: 'spline', nodeCount: 4 })
    const merged = mergeReconstructions(bundle.observed, new Map(outcomes.map((o) => [o.index, o])))
    expect(merged.filter((m) => m.status === 'reconstructed')).toHaveLength(bundle.missingIndices.length)
    const curve = sampleCurve(outcomes[0])
    expect(curve[0].x).toBe(knownPoints(bundle.observed)[0].x)
  })
})

describe('error metrics', () => {
  it('computes MAE, RMSE and maximum absolute error', () => {
    const m = computeErrorMetrics([
      { actual: 10, estimate: 12 },
      { actual: 20, estimate: 19 },
      { actual: 30, estimate: 34 },
    ])
    expect(m.mae).toBeCloseTo(7 / 3, 12)
    expect(m.rmse).toBeCloseTo(Math.sqrt(21 / 3), 12)
    expect(m.maxAbsError).toBe(4)
    expect(m.maxAbsErrorAt).toBe(2)
  })

  it('returns zero error for perfect estimates', () => {
    const m = computeErrorMetrics([{ actual: 5, estimate: 5 }])
    expect([m.mae, m.rmse, m.maxAbsError]).toEqual([0, 0, 0])
  })

  it('rejects empty and non-finite comparison sets', () => {
    expect(() => computeErrorMetrics([])).toThrow(EvaluationError)
    expect(() => computeErrorMetrics([{ actual: 1, estimate: NaN }])).toThrow(EvaluationError)
  })
})

describe('accuracy experiment', () => {
  it('hides exactly the chapter 4 mask for synthetic data and scores every method', () => {
    const bundle = createSyntheticBundle()
    const { reference, hiddenPositions } = planExperiment(bundle, 15, 1)
    expect(reference.values).toHaveLength(bundle.observed.measurements.length)
    expect(hiddenPositions).toEqual(bundle.missingIndices)
    const experiment = runAccuracyExperiment(reference, hiddenPositions, 4)
    for (const r of experiment.results) {
      expect(r.metrics?.n).toBe(hiddenPositions.length)
      expect(r.rows.every((row) => row.actual === bundle.groundTruth.values.get(row.sourceIndex))).toBe(true)
    }
    expect(experiment.bestByRmse).not.toBeNull()
  })

  it('treats Lagrange and Newton as a tie instead of ranking floating-point noise', () => {
    const bundle = createSyntheticBundle()
    const { reference, hiddenPositions } = planExperiment(bundle, 15, 1)
    const experiment = runAccuracyExperiment(reference, hiddenPositions, 4)
    const ranked = rankByRmse(experiment.results).map((r) => r.method)
    expect(ranked.indexOf('lagrange')).toBeLessThan(ranked.indexOf('newton'))
    expect(experiment.tiedBest.includes('lagrange')).toBe(experiment.tiedBest.includes('newton'))
  })

  it('scores a polynomial series perfectly when the method can represent it', () => {
    const timestamps = [0, 1, 2, 3, 4, 5, 6, 7]
    const values = timestamps.map((t) => 0.5 * t * t + 2 * t + 20)
    const reference = { sourceIndices: timestamps, timestamps, values }
    const result = runAccuracyExperiment(reference, [2, 5], 4, ['lagrange', 'newton'])
    for (const r of result.results) expect(r.metrics!.maxAbsError).toBeLessThan(1e-9)
  })

  it('excludes genuinely missing CSV rows and holds out known interior rows instead', () => {
    const parsed = parseLatencyCsv(SAMPLE_CSV)
    if (!parsed.ok) throw new Error('sample CSV should be valid')
    const bundle = createCsvBundle('sample.csv', parsed.rows)
    const { reference, hiddenPositions } = planExperiment(bundle, 25, 4)
    expect(reference.values).toHaveLength(8) // 10 rows, 2 without a value
    expect(hiddenPositions.length).toBe(2)
    expect(hiddenPositions).not.toContain(0)
    expect(hiddenPositions).not.toContain(7)
  })
})

describe('CSV import', () => {
  it('parses the sample file and treats empty or "timeout" cells as missing', () => {
    const result = parseLatencyCsv(SAMPLE_CSV)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rows).toHaveLength(10)
    expect(result.missingCount).toBe(2)
    expect(result.rows[3].pingMs).toBeNull()
  })

  const errorsOf = (text: string) => {
    const r = parseLatencyCsv(text)
    if (r.ok) throw new Error('expected failure')
    return r.errors.map((e) => `${e.line ?? '-'}: ${e.message}`).join('\n')
  }

  it('reports each kind of invalid input with its line number', () => {
    expect(errorsOf('')).toMatch(/empty/)
    expect(errorsOf('time,ping\n0,1')).toMatch(/Header/)
    expect(errorsOf('timestamp,ping_ms\n0,10\n1,abc\n2,12\n3,13\n4,14')).toMatch(/3: Latency "abc" is not a number/)
    expect(errorsOf('timestamp,ping_ms\n0,10\n1,-4\n2,12\n3,13\n4,14')).toMatch(/3: Latency -4 ms is negative/)
    expect(errorsOf('timestamp,ping_ms\n0,10\n1,11\n1,12\n3,13\n4,14')).toMatch(/4: Timestamp 1 duplicates line 3/)
    expect(errorsOf('timestamp,ping_ms\n0,10\n2,11\n1,12\n3,13\n4,14')).toMatch(/4: Timestamp 1 is earlier/)
    expect(errorsOf('timestamp,ping_ms\n0,10\n,11\n2,12\n3,13')).toMatch(/3: Timestamp is missing/)
    expect(errorsOf('timestamp,ping_ms\n0,10\n1,11,5\n2,12\n3,13\n4,14')).toMatch(/3: Expected 2 cells/)
    expect(errorsOf('timestamp,ping_ms\n0,10\n1,\n2,12')).toMatch(/at least 4/)
  })

  it('warns when an endpoint has no value', () => {
    const r = parseLatencyCsv('timestamp,ping_ms\n0,10\n1,11\n2,12\n3,13\n4,')
    expect(r.ok && r.warnings.length).toBe(1)
  })

  it('normalises timestamps to start at zero', () => {
    const r = parseLatencyCsv('timestamp,ping_ms\n1700000000,10\n1700000001.5,11\n1700000003,12\n1700000004,13')
    if (!r.ok) throw new Error('expected success')
    const bundle = createCsvBundle('epoch.csv', r.rows)
    expect(bundle.observed.measurements.map((m) => m.timestamp)).toEqual([0, 1.5, 3, 4])
  })
})

describe('probe simulator', () => {
  it('produces deterministic RTTs equal to the sum of hop delays plus processing', () => {
    const a = createProbeSimulator(5)
    const b = createProbeSimulator(5)
    const p = a()
    expect(b()).toEqual(p)
    const sum = p.hops.reduce((s, h) => s + h.delayMs, 0) + p.serverProcessingMs
    expect(p.rttMs).toBeCloseTo(sum, 6)
    expect(p.hops).toHaveLength(4)
  })

  it('records no RTT when the probe times out', () => {
    const probe = createProbeSimulator(1)({ forceTimeout: true })
    expect(probe.timedOut).toBe(true)
    expect(probe.rttMs).toBeNull()
  })
})
