import { isMissingCell, isNumericCell } from '../csv/parseLatencyCsv'
import { createRng } from '../../simulation/random'
import type { ObservedDataset } from '../../types/measurement'

/** A record exactly as a collector might hand it over: two text cells. */
export interface RawRecord {
  readonly id: number
  readonly timestamp: string
  readonly ping: string
  /** set on the faults deliberately injected to demonstrate validation */
  readonly injected?: 'not-a-number' | 'negative' | 'duplicate' | 'no-timestamp'
}

export interface AcceptedRecord {
  readonly record: RawRecord
  readonly timestamp: number
  readonly pingMs: number | null
}

export interface RejectedRecord {
  readonly record: RawRecord
  readonly reason: string
}

export interface PreparationResult {
  /** records in the order they arrived */
  readonly arrivals: readonly RawRecord[]
  /** stage 1: records that passed validation, still in arrival order */
  readonly accepted: readonly AcceptedRecord[]
  readonly rejected: readonly RejectedRecord[]
  /** stage 2: accepted records ordered by timestamp */
  readonly sorted: readonly AcceptedRecord[]
  /** stage 3: ids of sorted records that carry no value */
  readonly missingIds: ReadonlySet<number>
}

/**
 * Validate → sort → identify missing. The same cell rules as the CSV importer, but row by
 * row: invalid rows are set aside with a reason instead of rejecting the whole file, which
 * is what a streaming collector has to do.
 */
export function runPreparationPipeline(arrivals: readonly RawRecord[]): PreparationResult {
  const accepted: AcceptedRecord[] = []
  const rejected: RejectedRecord[] = []
  const seen = new Set<number>()

  for (const record of arrivals) {
    const t = record.timestamp.trim()
    const v = record.ping.trim()
    if (t === '') {
      rejected.push({ record, reason: 'no timestamp' })
      continue
    }
    if (!isNumericCell(t)) {
      rejected.push({ record, reason: `timestamp "${t}" is not a number` })
      continue
    }
    const timestamp = Number(t)
    let pingMs: number | null = null
    if (!isMissingCell(v)) {
      if (!isNumericCell(v)) {
        rejected.push({ record, reason: `"${v}" is not a number` })
        continue
      }
      pingMs = Number(v)
      if (pingMs < 0) {
        rejected.push({ record, reason: `negative latency ${v} ms` })
        continue
      }
    }
    if (seen.has(timestamp)) {
      rejected.push({ record, reason: `duplicate timestamp ${t} s` })
      continue
    }
    seen.add(timestamp)
    accepted.push({ record, timestamp, pingMs })
  }

  const sorted = [...accepted].sort((a, b) => a.timestamp - b.timestamp)
  const missingIds = new Set(sorted.filter((r) => r.pingMs === null).map((r) => r.record.id))
  return { arrivals, accepted, rejected, sorted, missingIds }
}

/**
 * Turns the observed dataset back into a raw, out-of-order stream (as records arrive from
 * several probes and threads) and injects four labelled faults so validation has something
 * to catch. Deterministic for a seed.
 */
export function buildRawStream(observed: ObservedDataset, seed = 5): RawRecord[] {
  const rng = createRng(seed)
  const base: RawRecord[] = observed.measurements.map((m) => ({
    id: m.index,
    timestamp: String(m.timestamp),
    ping: m.observedPingMs === null ? '' : String(m.observedPingMs),
  }))

  // network-order arrival: mostly in time order, with local reordering
  const arrivals = base
    .map((r, i) => ({ r, key: i + (rng() - 0.5) * 9 }))
    .sort((a, b) => a.key - b.key)
    .map((e) => e.r)

  const known = base.filter((r) => r.ping !== '')
  const pick = () => known[Math.floor(rng() * known.length)]
  let next = base.length
  const between = (r: RawRecord) => String(Number(r.timestamp) + 0.5)

  const insertAt = (record: RawRecord, at: number) => arrivals.splice(Math.min(arrivals.length, Math.max(0, at)), 0, record)

  const nan = pick()
  insertAt({ id: next++, timestamp: between(nan), ping: 'abc', injected: 'not-a-number' }, Math.floor(arrivals.length * 0.2))
  const neg = pick()
  insertAt({ id: next++, timestamp: between(neg), ping: `-${neg.ping}`, injected: 'negative' }, Math.floor(arrivals.length * 0.55))
  insertAt({ id: next++, timestamp: '', ping: pick().ping, injected: 'no-timestamp' }, Math.floor(arrivals.length * 0.75))
  // the duplicate must arrive after its original so the original is the one kept
  const dup = pick()
  const originalAt = arrivals.findIndex((r) => r.id === dup.id)
  insertAt({ id: next++, timestamp: dup.timestamp, ping: String(Math.round((Number(dup.ping) + 3.1) * 10) / 10), injected: 'duplicate' }, originalAt + 3)

  return arrivals
}
