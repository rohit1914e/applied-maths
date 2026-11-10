import type { DatasetBundle } from '../types/measurement'

/**
 * The missing record the interpolation scene zooms into: the first gap with at least two
 * measured neighbours on each side (so a cubic window can surround it), falling back to
 * the first gap with one on each side. Null when nothing can be interpolated.
 */
export function chooseFocusGap(bundle: DatasetBundle): number | null {
  const ms = bundle.observed.measurements
  const knownBefore = (i: number) => ms.slice(0, i).filter((m) => m.status === 'observed').length
  const knownAfter = (i: number) => ms.slice(i + 1).filter((m) => m.status === 'observed').length
  const good = bundle.missingIndices.find((i) => knownBefore(i) >= 2 && knownAfter(i) >= 2)
  if (good !== undefined) return good
  return bundle.missingIndices.find((i) => knownBefore(i) >= 1 && knownAfter(i) >= 1) ?? null
}
