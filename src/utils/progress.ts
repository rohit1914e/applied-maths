/** Maps progress p onto the sub-range [a, b], clamped to 0–1 (for staged animations). */
export function segment(p: number, a: number, b: number): number {
  const v = (p - a) / (b - a)
  return v < 0 ? 0 : v > 1 ? 1 : v
}
