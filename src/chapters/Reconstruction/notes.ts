import type { PresenterNotes } from '../../types/presentation'

export const reconstructionNotes: PresenterNotes = {
  explain: [
    'The chart is the active dataset from chapter 4. Crimson rings on the time axis are missing records.',
    'Choose a method and a missing record (click a ring or use the arrows), then press "Reconstruct".',
    'The amber curve is the interpolant; ringed points are the nodes it used. The amber diamond is the reconstructed value.',
    'For Lagrange and Newton, "Nodes" sets the local window (default 4 = cubic). For the spline every observed point is used.',
    'The panel shows the real intermediate values: basis weights, Newton coefficients, or the spline interval and coefficients.',
    '"Reconstruct all" fills every gap with the selected method. Reconstructed values are never reused as nodes.',
  ],
  terms: [
    { term: 'Node window', meaning: 'the known points closest to the target, at least one on each side.' },
    { term: 'Reconstructed', meaning: 'estimated by interpolation, shown distinctly from measured values.' },
  ],
  narration:
    'Let us fill a gap live. I pick the spline and this missing record. The curve is drawn through the known measurements, and where it crosses the missing time we read off the estimate. Now I switch to Lagrange with the same record — notice that Newton gives the same value as Lagrange, because they share the nodes.',
  questions: [
    { q: 'Why do Lagrange and spline differ?', a: 'Lagrange/Newton fit one cubic to four local nodes; the spline is a global piecewise cubic constrained by all nodes and smoothness conditions.' },
    { q: 'What happens with more nodes?', a: 'Try 8–10: the polynomial can overshoot between nodes. That is the Runge effect and why the degree is capped.' },
    { q: 'What if the missing record is at the very end?', a: 'It is refused: there is no known point beyond it, so estimating it would be extrapolation.' },
  ],
}
