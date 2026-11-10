import { describe, expect, it, vi } from 'vitest'
import { allBeatStops, beatPosition, currentBeat, layoutScenes, locate, segment, stepBeat, totalLength, visibleScenes } from './timeline'
import { createStore } from './store'
import { handleShortcut, type ShortcutHandlers } from '../hooks/useKeyboardShortcuts'
import { buildRawStream, runPreparationPipeline } from '../data/preparation/preparationPipeline'
import { createSyntheticBundle, createCsvBundle } from '../data/datasets'
import { parseLatencyCsv, SAMPLE_CSV } from '../data/csv/parseLatencyCsv'
import { chooseFocusGap } from '../reconstruction/focus'
import { lagrangeBasisFunction, lagrangeInterpolate } from '../algorithms/lagrange/lagrange'
import { newtonPartialPolynomial, newtonPolynomial } from '../algorithms/newton/newton'
import { createProbeSimulator } from '../simulation/networkSimulation/simulateProbe'

describe('story timeline', () => {
  const spans = layoutScenes([3, 4, 2], 0.6)

  it('lays scenes end to end, with an entry cross-fade for every scene but the first', () => {
    expect(spans.map((s) => s.start)).toEqual([0, 3, 7])
    expect(spans.map((s) => s.entry)).toEqual([0, 0.6, 0.6])
    expect(totalLength(spans)).toBe(9)
  })

  it('maps a position to scene, content progress and fade-in', () => {
    expect(locate(spans, 0)).toEqual({ index: 0, local: 0, enter: 1 })
    expect(locate(spans, 1.5)).toMatchObject({ index: 0, local: 0.5 })
    expect(locate(spans, 3.3)).toMatchObject({ index: 1, local: 0, enter: expect.closeTo(0.5, 9) })
    expect(locate(spans, 3.6 + 1.7)).toMatchObject({ index: 1, local: expect.closeTo(0.5, 9), enter: 1 })
    expect(locate(spans, 99)).toMatchObject({ index: 2, local: 1 })
    expect(locate(spans, -5)).toMatchObject({ index: 0, local: 0 })
  })

  it('cross-fades exactly two scenes during an entry window', () => {
    expect(visibleScenes(spans, 1)).toEqual([{ index: 0, opacity: 1 }])
    const mid = visibleScenes(spans, 3.3)
    expect(mid.map((v) => v.index)).toEqual([0, 1])
    expect(mid[0].opacity + mid[1].opacity).toBeCloseTo(1, 12)
    expect(visibleScenes(spans, 4)).toEqual([{ index: 1, opacity: 1 }])
  })

  it('steps between beats in both directions and reports the current beat', () => {
    const stops = allBeatStops(spans, [
      [{ at: 0, label: 'a' }, { at: 1, label: 'b', seconds: 3 }],
      [{ at: 0, label: 'c' }],
      [{ at: 0, label: 'd' }, { at: 0.5, label: 'e' }],
    ])
    expect(stops.map((s) => s.position)).toEqual([0, 3, 3.6, 7.6, beatPosition(spans, 2, 0.5)])
    expect(stepBeat(stops, 0, 1)).toMatchObject({ beat: 1, seconds: 3 })
    expect(stepBeat(stops, 3, 1)).toMatchObject({ scene: 1, beat: 0 })
    expect(stepBeat(stops, 3.6, -1)).toMatchObject({ scene: 0, beat: 1 })
    expect(stepBeat(stops, 0, -1)).toBeNull()
    expect(stepBeat(stops, 99, 1)).toBeNull()
    expect(currentBeat(stops, 5)).toMatchObject({ scene: 1, beat: 0 })
  })

  it('splits content progress into sub-steps', () => {
    expect(segment(0.3, 0.2, 0.4)).toBeCloseTo(0.5, 12)
    expect(segment(0.1, 0.2, 0.4)).toBe(0)
    expect(segment(0.9, 0.2, 0.4)).toBe(1)
  })
})

describe('number store', () => {
  it('notifies only on change', () => {
    const store = createStore(0)
    const listener = vi.fn()
    const off = store.subscribe(listener)
    store.set(0)
    store.set(0.5)
    store.set(0.5)
    off()
    store.set(1)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.get()).toBe(1)
  })
})

describe('keyboard shortcuts', () => {
  const handlers = () => ({
    nextBeat: vi.fn<() => void>(),
    previousBeat: vi.fn<() => void>(),
    nextScene: vi.fn<() => void>(),
    previousScene: vi.fn<() => void>(),
    goto: vi.fn<(i: number) => void>(),
    toggleFullscreen: vi.fn<() => void>(),
    toggleNotes: vi.fn<() => void>(),
    togglePause: vi.fn<() => void>(),
    toggleReducedMotion: vi.fn<() => void>(),
    faster: vi.fn<() => void>(),
    slower: vi.fn<() => void>(),
    replay: vi.fn<() => void>(),
    restart: vi.fn<() => void>(),
  }) satisfies ShortcutHandlers
  const key = (k: string, target: HTMLElement = document.body, extra: KeyboardEventInit = {}) => {
    const e = new KeyboardEvent('keydown', { key: k, ...extra })
    Object.defineProperty(e, 'target', { value: target })
    return e
  }

  it('maps presenter keys', () => {
    const h = handlers()
    for (const k of [' ', 'ArrowDown', 'PageDown']) handleShortcut(key(k), h, 7)
    for (const k of ['ArrowUp', 'PageUp']) handleShortcut(key(k), h, 7)
    handleShortcut(key(' ', document.body, { shiftKey: true }), h, 7)
    handleShortcut(key('ArrowRight'), h, 7)
    handleShortcut(key('ArrowLeft'), h, 7)
    for (const k of ['f', 'n', 'p', 'm', '+', '-', 'r', 'Home']) handleShortcut(key(k), h, 7)
    handleShortcut(key('4'), h, 7)
    expect(h.nextBeat).toHaveBeenCalledTimes(3)
    expect(h.previousBeat).toHaveBeenCalledTimes(3)
    expect(h.nextScene).toHaveBeenCalledTimes(1)
    expect(h.previousScene).toHaveBeenCalledTimes(1)
    for (const fn of ['toggleFullscreen', 'toggleNotes', 'togglePause', 'toggleReducedMotion', 'faster', 'slower', 'replay', 'restart'] as const) {
      expect(h[fn]).toHaveBeenCalledTimes(1)
    }
    expect(h.goto).toHaveBeenCalledWith(3)
  })

  it('ignores form fields, modifiers and scene numbers that do not exist', () => {
    const h = handlers()
    expect(handleShortcut(key('ArrowDown', document.createElement('input')), h, 7)).toBe(false)
    expect(handleShortcut(key('n', document.body, { ctrlKey: true }), h, 7)).toBe(false)
    expect(handleShortcut(key('9'), h, 7)).toBe(false)
    expect(handleShortcut(key(' ', document.createElement('button')), h, 7)).toBe(false)
    expect(h.nextBeat).not.toHaveBeenCalled()
  })
})

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
