/**
 * Content-progress layout of the interpolation scene. Each method has a construction window
 * (scrubbed by scrolling) followed by a short hold where the finished result stays put.
 */
export const PHASES = {
  intro: [0, 0.08],
  lagrange: [0.08, 0.28, 0.33],
  newton: [0.33, 0.53, 0.58],
  spline: [0.58, 0.78, 0.83],
  compare: [0.83, 1],
} as const

export type Phase = 'intro' | 'lagrange' | 'newton' | 'spline' | 'compare'

/** Tolerance so a beat placed exactly on a boundary lands in the phase that starts there. */
const EPS = 1e-6

export function phaseAt(p: number): Phase {
  if (p < PHASES.intro[1] - EPS) return 'intro'
  if (p < PHASES.lagrange[2] - EPS) return 'lagrange'
  if (p < PHASES.newton[2] - EPS) return 'newton'
  if (p < PHASES.spline[2] - EPS) return 'spline'
  return 'compare'
}
