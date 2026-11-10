import type { Point } from '../types/interpolation'
import { InterpolationError } from './shared/validation'

/**
 * Chooses `count` known points nearest to x for a local polynomial, guaranteeing at least
 * one node on each side so the estimate is an interpolation, never an extrapolation.
 *
 * Distance ties are broken towards the side with fewer chosen nodes, then towards the left,
 * so the choice is deterministic. Lagrange and Newton always receive the same window.
 */
export function selectNodesAround(known: readonly Point[], x: number, count: number): Point[] {
  if (count < 2) throw new InterpolationError('INSUFFICIENT_NODES', 'A polynomial needs at least 2 nodes.')
  const left = known.filter((p) => p.x < x).sort((a, b) => b.x - a.x)
  const right = known.filter((p) => p.x > x).sort((a, b) => a.x - b.x)
  const exact = known.filter((p) => p.x === x)

  if (left.length === 0 || right.length === 0) {
    throw new InterpolationError(
      'EXTRAPOLATION',
      `x = ${x} has no known measurement on its ${left.length === 0 ? 'left' : 'right'}; it cannot be interpolated.`,
    )
  }

  const chosen: Point[] = [...exact]
  let l = 0
  let r = 0
  const take = (side: 'left' | 'right') => {
    if (side === 'left') chosen.push(left[l++])
    else chosen.push(right[r++])
  }
  take('left')
  if (chosen.length < count) take('right')

  while (chosen.length < count && (l < left.length || r < right.length)) {
    if (l >= left.length) take('right')
    else if (r >= right.length) take('left')
    else {
      const dl = x - left[l].x
      const dr = right[r].x - x
      if (dl < dr) take('left')
      else if (dr < dl) take('right')
      else take(l <= r ? 'left' : 'right')
    }
  }
  return chosen.sort((a, b) => a.x - b.x)
}
