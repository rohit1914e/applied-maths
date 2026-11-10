import Papa from 'papaparse'

export interface CsvRow {
  /** 1-based line number in the file (header is line 1) */
  readonly line: number
  readonly timestamp: number
  readonly pingMs: number | null
}

export interface CsvIssue {
  readonly line: number | null
  readonly message: string
}

export type CsvParseResult =
  | { readonly ok: true; readonly rows: readonly CsvRow[]; readonly warnings: readonly CsvIssue[]; readonly missingCount: number }
  | { readonly ok: false; readonly errors: readonly CsvIssue[] }

/** Cells that mean "no measurement recorded" rather than a typo. */
const MISSING_TOKENS = new Set(['', 'na', 'n/a', 'null', 'nan', 'timeout', '-'])
export const MIN_KNOWN_ROWS = 4
const MAX_REPORTED_ERRORS = 25

const NUMBER = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/

/**
 * Parses `timestamp,ping_ms` CSV. Every problem is reported with its line number; nothing
 * is silently dropped. An empty or "timeout"/"NA" ping cell is a missing measurement.
 */
export function parseLatencyCsv(text: string): CsvParseResult {
  const errors: CsvIssue[] = []
  const warnings: CsvIssue[] = []
  const push = (issue: CsvIssue) => {
    if (errors.length < MAX_REPORTED_ERRORS) errors.push(issue)
  }

  if (text.trim().length === 0) return { ok: false, errors: [{ line: null, message: 'The file is empty.' }] }

  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ''), { skipEmptyLines: 'greedy' })
  for (const e of parsed.errors) {
    push({ line: e.row != null ? e.row + 1 : null, message: `Malformed CSV: ${e.message}.` })
  }

  const [header, ...body] = parsed.data
  const columns = (header ?? []).map((c) => c.trim().toLowerCase())
  if (columns.length !== 2 || columns[0] !== 'timestamp' || columns[1] !== 'ping_ms') {
    return {
      ok: false,
      errors: [{ line: 1, message: `Header must be exactly "timestamp,ping_ms"; found "${(header ?? []).join(',')}".` }, ...errors],
    }
  }
  if (body.length === 0) return { ok: false, errors: [{ line: null, message: 'The file has a header but no data rows.' }] }

  const rows: CsvRow[] = []
  const seen = new Map<number, number>()
  let previous: CsvRow | null = null

  body.forEach((cells, k) => {
    const line = k + 2
    if (cells.length !== 2) {
      push({ line, message: `Expected 2 cells, found ${cells.length}.` })
      return
    }
    const [rawTime, rawPing] = cells.map((c) => c.trim())
    if (rawTime === '') {
      push({ line, message: 'Timestamp is missing.' })
      return
    }
    if (!NUMBER.test(rawTime)) {
      push({ line, message: `Timestamp "${rawTime}" is not a number.` })
      return
    }
    const timestamp = Number(rawTime)

    let pingMs: number | null = null
    if (!MISSING_TOKENS.has(rawPing.toLowerCase())) {
      if (!NUMBER.test(rawPing)) {
        push({ line, message: `Latency "${rawPing}" is not a number. Leave the cell empty to mark a missing measurement.` })
        return
      }
      pingMs = Number(rawPing)
      if (pingMs < 0) {
        push({ line, message: `Latency ${pingMs} ms is negative; round-trip time cannot be below zero.` })
        return
      }
    }

    const duplicateOf = seen.get(timestamp)
    if (duplicateOf !== undefined) {
      push({ line, message: `Timestamp ${timestamp} duplicates line ${duplicateOf}.` })
      return
    }
    if (previous && timestamp < previous.timestamp) {
      push({ line, message: `Timestamp ${timestamp} is earlier than ${previous.timestamp} on line ${previous.line}; rows must be in time order.` })
      return
    }
    seen.set(timestamp, line)
    const row = { line, timestamp, pingMs }
    rows.push(row)
    previous = row
  })

  const known = rows.filter((r) => r.pingMs !== null)
  if (errors.length === 0 && known.length < MIN_KNOWN_ROWS) {
    push({ line: null, message: `Only ${known.length} rows have a latency value; at least ${MIN_KNOWN_ROWS} are needed.` })
  }
  if (errors.length > 0) return { ok: false, errors }

  const missingCount = rows.length - known.length
  if (rows[0].pingMs === null || rows[rows.length - 1].pingMs === null) {
    warnings.push({
      line: null,
      message: 'The first or last row has no value. Those records lie outside the known range and cannot be interpolated.',
    })
  }
  return { ok: true, rows, warnings, missingCount }
}

export const SAMPLE_CSV = `timestamp,ping_ms
0,24.1
1,27.6
2,31.0
3,
4,41.8
5,timeout
6,47.9
7,45.2
8,39.7
9,36.4
`
