import type { PresenterNotes } from '../../types/presentation'

export const numericalMethodsNotes: PresenterNotes = {
  explain: [
    'Worked example: the chapter 3 timeline. Known points at t = 1, 2, 3, 5, 7; we estimate the missing record at t = 4.',
    'Lagrange: each basis polynomial L_i equals 1 at its own node and 0 at the others. The estimate is the weighted sum Σ y_i L_i(x).',
    'Newton: the divided-difference table gives coefficients a_k; nested multiplication evaluates the polynomial efficiently.',
    'Lagrange and Newton use the identical four nodes, so they produce the same cubic polynomial and the same estimate (up to rounding).',
    'Natural cubic spline: one cubic per interval, joined smoothly (S, S′, S″ continuous), with S″ = 0 at both ends. Uses all five known points.',
    'Space reveals: construction → substitution with numbers → final estimate.',
  ],
  terms: [
    { term: 'Basis polynomial', meaning: 'L_i(x) = Π_{j≠i} (x − x_j)/(x_i − x_j).' },
    { term: 'Divided difference', meaning: 'f[x_i, …, x_{i+k}]: recursive slope of slopes; the Newton coefficients.' },
    { term: 'Knot', meaning: 'a node where two spline pieces join.' },
    { term: 'Natural boundary', meaning: 'second derivative zero at the first and last node.' },
    { term: 'Runge phenomenon', meaning: 'oscillation of high-degree polynomials between equally spaced nodes.' },
  ],
  narration:
    'All three methods answer the same question: what smooth curve passes exactly through the measurements we have? Lagrange builds it from basis polynomials. Newton builds the same polynomial incrementally from a table of divided differences. The spline takes a different philosophy: instead of one polynomial for everything, it joins short cubic pieces so smoothly that you cannot see the seams.',
  formula:
    'Lagrange: P(x) = Σ y_i L_i(x).\nNewton: P(x) = a0 + a1(x−x0) + a2(x−x0)(x−x1) + a3(x−x0)(x−x1)(x−x2), a_k = f[x0…xk].\nSpline: h_{i−1}M_{i−1} + 2(h_{i−1}+h_i)M_i + h_iM_{i+1} = 6[(y_{i+1}−y_i)/h_i − (y_i−y_{i−1})/h_{i−1}], M0 = Mn = 0.',
  questions: [
    { q: 'Why do Lagrange and Newton give the same answer?', a: 'Through n+1 distinct nodes there is exactly one polynomial of degree ≤ n (uniqueness theorem). Lagrange and Newton are two ways of writing it.' },
    { q: 'Why not use one polynomial through all 48 points?', a: 'Degree 47 would oscillate wildly (Runge) and lose precision in floating point. We use a local window of 4 nodes (cubic) by default and cap the degree at 9.' },
    { q: 'What is the advantage of Newton over Lagrange?', a: 'Adding a node adds one new coefficient without recomputing the others, and nested evaluation costs O(n) per point after an O(n²) table.' },
    { q: 'How is the spline system solved?', a: 'It is tridiagonal and strictly diagonally dominant, so the Thomas algorithm solves it in O(n) without pivoting.' },
    { q: 'Error of polynomial interpolation?', a: 'f(x) − P(x) = f^(n+1)(ξ)/(n+1)! · Π(x − x_i) for some ξ in the node range, assuming f is smooth enough.' },
  ],
}
