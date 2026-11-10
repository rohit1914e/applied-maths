import { describe, expect, it } from 'vitest'
import { computeLiveStats, createLiveEngine, legSeconds } from './liveEngine'

const run = (engine: ReturnType<typeof createLiveEngine>, seconds: number, step = 1 / 60) => {
  const done = []
  for (let t = 0; t < seconds; t += step) done.push(...engine.advance(step))
  return done
}

describe('live network engine', () => {
  it('starts with a full trace and probes already in flight', () => {
    const engine = createLiveEngine()
    expect(engine.records()).toHaveLength(60)
    expect(engine.flights().length).toBeGreaterThan(0)
    expect(engine.lastSuccessful()).not.toBeNull()
  })

  it('completes about one probe per simulated second and keeps the window size', () => {
    const engine = createLiveEngine()
    const done = run(engine, 10)
    expect(done.length).toBeGreaterThanOrEqual(9)
    expect(done.length).toBeLessThanOrEqual(13)
    expect(engine.records()).toHaveLength(60)
    expect(engine.records().at(-1)!.seq).toBeGreaterThan(60)
  })

  it('is deterministic for a seed', () => {
    const a = run(createLiveEngine({ seed: 5 }), 6)
    const b = run(createLiveEngine({ seed: 5 }), 6)
    expect(a).toEqual(b)
  })

  it('keeps every dot on the path between client (0) and server (1)', () => {
    const engine = createLiveEngine()
    for (let i = 0; i < 300; i++) {
      engine.advance(1 / 30)
      for (const f of engine.flights()) {
        for (const dot of [f.request, f.reply]) {
          if (dot) {
            expect(dot.pos).toBeGreaterThanOrEqual(0)
            expect(dot.pos).toBeLessThanOrEqual(1)
          }
        }
      }
    }
  })

  it('records timeouts as missing values at the configured loss rate', () => {
    const none = createLiveEngine({ lossProbability: 0 })
    expect(run(none, 30).every((r) => r.rtt !== null)).toBe(true)
    const lossy = createLiveEngine({ lossProbability: 0 })
    lossy.setLossProbability(1)
    const after = run(lossy, 12).filter((r) => r.seq > 64)
    expect(after.length).toBeGreaterThan(3)
    expect(after.every((r) => r.rtt === null)).toBe(true)
  })

  it('clamps hop animation durations', () => {
    expect(legSeconds(0)).toBe(0.45)
    expect(legSeconds(1000)).toBe(1.25)
  })
})

describe('live statistics', () => {
  it('averages successful probes and measures jitter between consecutive replies', () => {
    const stats = computeLiveStats([
      { seq: 1, rtt: 30 },
      { seq: 2, rtt: 34 },
      { seq: 3, rtt: null },
      { seq: 4, rtt: 31 },
      { seq: 5, rtt: 29 },
    ])
    expect(stats.mean).toBeCloseTo((30 + 34 + 31 + 29) / 4, 12)
    expect(stats.jitter).toBeCloseTo((4 + 2) / 2, 12) // pairs across the timeout are skipped
    expect(stats.timeouts).toBe(1)
    expect(stats.timeoutRate).toBeCloseTo(0.2, 12)
    expect(stats.latest).toEqual({ seq: 5, rtt: 29 })
  })

  it('handles an empty trace', () => {
    expect(computeLiveStats([])).toMatchObject({ mean: 0, jitter: 0, timeouts: 0, latest: null })
  })
})
