import { createProbeSimulator, type NetworkProfile, type ProbeResult } from './simulateProbe'

export interface LiveRecord {
  readonly seq: number
  /** null when the reply never arrived (timeout) */
  readonly rtt: number | null
}

/** Where one probe's dots are: positions run 0 (client) → 0.5 (router) → 1 (server). */
export interface FlightView {
  readonly slot: number
  readonly request: { readonly pos: number } | null
  readonly reply: { readonly pos: number; readonly opacity: number; readonly lost: boolean } | null
  readonly atServer: boolean
}

export interface LiveEngineOptions {
  readonly seed?: number
  /** probes per second of simulated time (ping's default is one) */
  readonly interval?: number
  /** records kept for the trace */
  readonly window?: number
  readonly lossProbability?: number
  readonly load?: (sequence: number) => number
}

export const ENGINE_POOL = 8
const PAUSE = { router: 0.1, server: 0.2 }

/** Visual seconds a hop takes: proportional to its simulated delay, clamped to stay watchable. */
export const legSeconds = (ms: number) => Math.min(1.25, Math.max(0.45, 0.35 + ms / 16))

/** A network whose load rises and falls slowly, with occasional bursts. */
export const DEFAULT_LOAD = (n: number) => 1 + 0.9 * (0.5 + 0.5 * Math.sin(n / 13)) + 0.5 * Math.max(0, Math.sin(n / 5.3) - 0.7)

interface Flight {
  readonly probe: ProbeResult
  readonly legs: readonly number[]
  t: number
  readonly slot: number
}

function view(f: Flight): FlightView & { done: boolean } {
  const [l1, l2, l3, l4] = f.legs
  const bounds = [l1, PAUSE.router, l2, PAUSE.server, l3, PAUSE.router, l4]
  let t = f.t
  let seg = 0
  while (seg < bounds.length && t > bounds[seg]) {
    t -= bounds[seg]
    seg++
  }
  const u = seg < bounds.length ? t / bounds[seg] : 1
  const lost = f.probe.timedOut
  const base = { slot: f.slot, request: null, reply: null, atServer: false, done: false }
  switch (seg) {
    case 0:
      return { ...base, request: { pos: 0.45 * u } }
    case 1:
      return { ...base, request: { pos: 0.45 + 0.1 * u } }
    case 2:
      return { ...base, request: { pos: 0.55 + 0.45 * u } }
    case 3:
      return { ...base, atServer: true }
    case 4:
      return { ...base, reply: { pos: 1 - 0.45 * u, opacity: 1, lost: false } }
    case 5:
      return lost ? { ...base, reply: { pos: 0.55, opacity: 1 - u, lost: true } } : { ...base, reply: { pos: 0.55 - 0.1 * u, opacity: 1, lost: false } }
    case 6:
      return lost ? { ...base, done: u >= 1 } : { ...base, reply: { pos: 0.45 - 0.45 * u, opacity: 1, lost: false } }
    default:
      return { ...base, done: true }
  }
}

/**
 * The live ping simulation behind the hero and the simulation section. It is a plain object
 * advanced by `advance(dt)`, so the UI decides when frames happen (only while visible and
 * running) and the logic is testable without a browser.
 */
export function createLiveEngine(options: LiveEngineOptions = {}) {
  const interval = options.interval ?? 1
  const window = options.window ?? 60
  const profile = { lossProbability: options.lossProbability ?? 0.06, load: options.load ?? DEFAULT_LOAD }
  const send = createProbeSimulator(options.seed ?? 2026, profile as NetworkProfile)

  let records: LiveRecord[] = []
  let lastOk: ProbeResult | null = null
  for (let i = 0; i < window; i++) {
    const p = send()
    records.push({ seq: p.sequence, rtt: p.rttMs })
    if (!p.timedOut) lastOk = p
  }
  // a few probes already travelling, so measurements land within the first second
  let flights: Flight[] = [2.7, 1.7, 0.7].map((t, slot) => {
    const probe = send()
    return { probe, legs: probe.hops.map((h) => legSeconds(h.delayMs)), t, slot }
  })
  let sinceLaunch = interval * 0.3

  return {
    records: () => records,
    lastSuccessful: () => lastOk,
    flights: (): FlightView[] => flights.map((f) => view(f)),
    setLossProbability(p: number) {
      profile.lossProbability = Math.min(1, Math.max(0, p))
    },
    /** Advances simulated time by `dt` seconds; returns the measurements completed in that time. */
    advance(dt: number): LiveRecord[] {
      sinceLaunch += dt
      while (sinceLaunch >= interval) {
        sinceLaunch -= interval
        const used = new Set(flights.map((f) => f.slot))
        const slot = Array.from({ length: ENGINE_POOL }, (_, i) => i).find((i) => !used.has(i))
        if (slot === undefined) continue
        const probe = send()
        flights.push({ probe, legs: probe.hops.map((h) => legSeconds(h.delayMs)), t: 0, slot })
      }
      const completed: LiveRecord[] = []
      flights = flights.filter((f) => {
        f.t += dt
        if (!view(f).done) return true
        completed.push({ seq: f.probe.sequence, rtt: f.probe.rttMs })
        if (!f.probe.timedOut) lastOk = f.probe
        return false
      })
      if (completed.length) records = [...records, ...completed.sort((a, b) => a.seq - b.seq)].slice(-window)
      return completed
    },
  }
}

export type LiveEngine = ReturnType<typeof createLiveEngine>

export interface LiveStats {
  readonly latest: LiveRecord | null
  readonly mean: number
  readonly jitter: number
  readonly timeouts: number
  readonly count: number
  readonly timeoutRate: number
  readonly lastSequence: number
}

/** Summary statistics of the probes in the trace (timeouts excluded from mean and jitter). */
export function computeLiveStats(records: readonly LiveRecord[]): LiveStats {
  const ok = records.flatMap((r) => (r.rtt === null ? [] : [r.rtt]))
  let jitterSum = 0
  let pairs = 0
  for (let i = 1; i < records.length; i++) {
    const a = records[i - 1].rtt
    const b = records[i].rtt
    if (a !== null && b !== null) {
      jitterSum += Math.abs(b - a)
      pairs++
    }
  }
  return {
    latest: records.at(-1) ?? null,
    mean: ok.length ? ok.reduce((s, v) => s + v, 0) / ok.length : 0,
    jitter: pairs ? jitterSum / pairs : 0,
    timeouts: records.length - ok.length,
    count: records.length,
    timeoutRate: records.length ? (records.length - ok.length) / records.length : 0,
    lastSequence: records.at(-1)?.seq ?? 0,
  }
}
