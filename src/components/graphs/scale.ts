export function linearScale([d0, d1]: readonly [number, number], [r0, r1]: readonly [number, number]) {
  const span = d1 - d0 || 1
  return (v: number) => r0 + ((v - d0) / span) * (r1 - r0)
}

/** "Nice" tick values (1, 2, 2.5, 5 × 10^k steps) covering [lo, hi]. */
export function niceTicks(lo: number, hi: number, count: number): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return []
  if (hi <= lo) return [lo]
  const raw = (hi - lo) / Math.max(1, count)
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? 10 * magnitude
  const start = Math.ceil(lo / step) * step
  const ticks: number[] = []
  for (let t = start; t <= hi + step * 1e-9; t += step) ticks.push(Number(t.toFixed(10)))
  return ticks
}
