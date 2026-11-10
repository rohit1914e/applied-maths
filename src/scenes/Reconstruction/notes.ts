import type { PresenterNotes } from '../../types/presentation'

export const reconstructionNotes: PresenterNotes = {
  explain: [
    'Scrolling sweeps across the dataset: at each gap the interpolant is drawn and the estimate appears as an amber diamond.',
    'Brown circles are measured values, amber diamonds are estimates, crimson rings mark where a record was missing. The legend says so on screen.',
    'Change the method or the number of nodes at any time; every estimate is recomputed and redrawn.',
    'The log lists each estimate; click one, or a crimson marker, to see its intermediate values.',
    'Estimates are never used as nodes for later estimates, so errors cannot accumulate.',
  ],
  terms: [
    { term: 'Node window', meaning: 'the measured points nearest the target, at least one on each side.' },
    { term: 'Reconstructed', meaning: 'estimated by interpolation and always shown differently from measured values.' },
  ],
  narration:
    'Now the method runs across the whole series. Each crimson gap gets its curve and its estimate, in amber, so nobody can mistake an estimate for a measurement. If I switch to Lagrange, everything is recomputed, and you can open any estimate to see the arithmetic behind it.',
  questions: [
    { q: 'Why do Lagrange and spline estimates differ?', a: 'Lagrange/Newton fit one cubic to four local nodes; the spline is a global piecewise cubic constrained by every node and smoothness conditions.' },
    { q: 'What happens with more nodes?', a: 'Try 8–10: the polynomial can overshoot between nodes. That is the Runge effect and why the degree is capped.' },
    { q: 'What if the missing record is at the very end?', a: 'It is refused as not interpolable: there is no measurement beyond it, so an estimate would be extrapolation.' },
  ],
}
