import { describe, expect, it } from 'vitest'
import { buildRawStream, runPreparationPipeline } from './preparation/preparationPipeline'
import { createSyntheticBundle, createCsvBundle } from './datasets'
import { parseLatencyCsv, SAMPLE_CSV } from './csv/parseLatencyCsv'
import { chooseFocusGap } from '../reconstruction/focus'
import { lagrangeBasisFunction, lagrangeInterpolate } from '../algorithms/lagrange/lagrange'
import { newtonPartialPolynomial, newtonPolynomial } from '../algorithms/newton/newton'
import { createProbeSimulator } from '../simulation/networkSimulation/simulateProbe'

describe('preparation pipeline', () => {
  const bundle = createSyntheticBundle()
  const raw = buildRawStream(bundle.observed)
  const result = runPreparationPipeline(raw)

  it('rejects exactly the four injected faults, each with a reason', () => {
    expect(raw).toHaveLength(bundle.observed.measurements.length + 4)
    expect(result.rejected.map((r) => r.record.injected).sort()).toEqual(['duplicate', 'negative', 'no-timestamp', 'not-a-number'])
    expect(result.rejected.every((r) => r.reason.length > 0)).toBe(true)
  })

  it('arrives out of order and sorts back into time order', () => {
    const arrivalTimes = result.accepted.map((r) => r.timestamp)
    expect(arrivalTimes).not.toEqual([...arrivalTimes].sort((a, b) => a - b))
    const sortedTimes = result.sorted.map((r) => r.timestamp)
    expect(sortedTimes).toEqual([...sortedTimes].sort((a, b) => a - b))
  })

  it('reproduces the observed dataset exactly, with the same missing records', () => {
    expect(result.sorted.map((r) => r.timestamp)).toEqual(bundle.observed.measurements.map((m) => m.timestamp))
    expect(result.sorted.map((r) => r.pingMs)).toEqual(bundle.observed.measurements.map((m) => m.observedPingMs))
    expect([...result.missingIds].sort((a, b) => a - b)).toEqual(bundle.missingIndices)
  })

  it('keeps the original when a duplicate timestamp arrives later', () => {
    const dup = result.rejected.find((r) => r.record.injected === 'duplicate')!
    const kept = result.sorted.find((r) => String(r.timestamp) === dup.record.timestamp)!
    expect(kept.record.injected).toBeUndefined()
  })

  it('works for imported CSV data', () => {
    const parsed = parseLatencyCsv(SAMPLE_CSV)
    if (!parsed.ok) throw new Error('sample should parse')
    const csv = createCsvBundle('sample.csv', parsed.rows)
    const r = runPreparationPipeline(buildRawStream(csv.observed))
    expect(r.sorted.map((x) => x.pingMs)).toEqual(csv.observed.measurements.map((m) => m.observedPingMs))
  })
})

describe('interpolation helpers', () => {
  const nodes = [{ x: 2, y: 28 }, { x: 3, y: 31 }, { x: 5, y: 42 }, { x: 7, y: 48 }]

  it('basis functions match the values used in the Lagrange sum', () => {
    const r = lagrangeInterpolate(nodes, 4)
    r.basis.forEach((b, i) => expect(lagrangeBasisFunction(nodes, i)(4)).toBeCloseTo(b.basisValue, 12))
    expect(lagrangeBasisFunction(nodes, 2)(5)).toBeCloseTo(1, 12)
    expect(lagrangeBasisFunction(nodes, 2)(7)).toBeCloseTo(0, 12)
  })

  it('Newton partial polynomials interpolate the first k+1 nodes and end at the full polynomial', () => {
    const p1 = newtonPartialPolynomial(nodes, 1)
    expect(p1(2)).toBeCloseTo(28, 12)
    expect(p1(3)).toBeCloseTo(31, 12)
    expect(newtonPartialPolynomial(nodes, 0)(6)).toBe(28)
    expect(newtonPartialPolynomial(nodes, 3)(4.5)).toBeCloseTo(newtonPolynomial(nodes)(4.5), 12)
  })

  it('chooses a focus gap with measured neighbours on both sides', () => {
    const bundle = createSyntheticBundle()
    const focus = chooseFocusGap(bundle)!
    expect(bundle.missingIndices).toContain(focus)
    const ms = bundle.observed.measurements
    expect(ms.slice(0, focus).filter((m) => m.status === 'observed').length).toBeGreaterThanOrEqual(2)
  })
})

describe('network profile', () => {
  it('loses replies at the requested rate and scales queuing with load', () => {
    const lossy = createProbeSimulator(3, { lossProbability: 0.2 })
    const lost = Array.from({ length: 2000 }, () => lossy()).filter((p) => p.timedOut).length
    expect(lost / 2000).toBeGreaterThan(0.17)
    expect(lost / 2000).toBeLessThan(0.23)

    const mean = (load: number) => {
      const sim = createProbeSimulator(9, { load: () => load })
      const xs = Array.from({ length: 2000 }, () => sim().rttMs!)
      return xs.reduce((a, b) => a + b, 0) / xs.length
    }
    expect(mean(3)).toBeGreaterThan(mean(1) + 10)
  })
})
