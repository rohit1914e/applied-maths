/** Consistent numeric formatting for every value shown on the stage. */
export function fmt(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—'
  const fixed = value.toFixed(digits)
  // avoid "-0.00"
  return /^-0\.?0*$/.test(fixed) ? fixed.slice(1) : fixed
}

export function fmtMs(value: number | null | undefined, digits = 2): string {
  return value === null || value === undefined ? '—' : `${fmt(value, digits)} ms`
}

/** Seconds with trailing zeros trimmed: 4 → "4", 4.25 → "4.25". */
export function fmtSeconds(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)))
}

/** A number for use inside a TeX string; negatives are parenthesised when needed. */
export function texNum(value: number, digits = 4, parenthesiseNegative = false): string {
  const s = fmt(value, digits)
  return parenthesiseNegative && value < 0 ? `(${s})` : s
}

export function texSeconds(value: number): string {
  return fmtSeconds(value)
}
