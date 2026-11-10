import type { PresenterNotes } from '../../types/presentation'

export const interpolationNotes: PresenterNotes = {
  explain: [
    'The scene zooms into a real gap of the active dataset. The nodes are its nearest measurements, at least one on each side.',
    'Lagrange: the lower panel draws each basis polynomial Lᵢ (1 at its own node, 0 at the others); the rows show Lᵢ at the missing time; their weighted sum P is drawn in amber.',
    'Newton: the divided-difference table fills column by column; the curve grows from P₀ (a constant) to P₃ (the cubic), one coefficient at a time; nested multiplication evaluates it.',
    'Spline: one cubic per interval is drawn segment by segment; the lower panel shows the second derivatives Mᵢ solved from the tridiagonal system.',
    'Compare: Lagrange and Newton give the same value because they are the same polynomial; the spline is a different interpolant.',
    'Scrolling builds each construction; the tabs jump to a method. Every number is computed by the algorithms for the current data.',
  ],
  terms: [
    { term: 'Basis polynomial', meaning: 'Lᵢ(x) = Π_{j≠i} (x − xⱼ)/(xᵢ − xⱼ).' },
    { term: 'Divided difference', meaning: 'f[xᵢ,…,xᵢ₊ₖ]: the recursive slope of slopes; the Newton coefficients.' },
    { term: 'Knot', meaning: 'a node where two spline pieces join.' },
    { term: 'Natural boundary', meaning: 'second derivative zero at the first and last knot.' },
    { term: 'Runge phenomenon', meaning: 'oscillation of high-degree polynomials between equally spaced nodes.' },
  ],
  narration:
    'Here is one missing record, with its measured neighbours. Lagrange builds the curve from basis polynomials, each switched on at one node and off at the others. Newton builds the same curve one term at a time, and you can watch it bend into place. The spline joins short cubic pieces so smoothly the seams disappear. Three constructions, and on the comparison the two polynomial methods land on exactly the same value.',
  formula:
    'Lagrange: P(x) = Σ yᵢ Lᵢ(x).\nNewton: P(x) = a₀ + a₁(x−x₀) + a₂(x−x₀)(x−x₁) + …, aₖ = f[x₀…xₖ].\nSpline: hᵢ₋₁Mᵢ₋₁ + 2(hᵢ₋₁+hᵢ)Mᵢ + hᵢMᵢ₊₁ = 6[(yᵢ₊₁−yᵢ)/hᵢ − (yᵢ−yᵢ₋₁)/hᵢ₋₁], M₀ = Mₙ = 0.',
  questions: [
    { q: 'Why do Lagrange and Newton give the same answer?', a: 'Through n+1 distinct nodes there is exactly one polynomial of degree ≤ n. Lagrange and Newton are two ways of writing it.' },
    { q: 'Why not one polynomial through all points?', a: 'A high degree oscillates (Runge) and loses precision. A local window of 4 nodes (cubic) is the default; the cap is 10 nodes.' },
    { q: 'What does Newton offer over Lagrange?', a: 'Adding a node adds one coefficient without recomputing the others, and evaluation is O(n) by nested multiplication.' },
    { q: 'How is the spline system solved?', a: 'It is tridiagonal and strictly diagonally dominant, so the Thomas algorithm solves it in O(n) without pivoting.' },
    { q: 'Error of polynomial interpolation?', a: 'f(x) − P(x) = f⁽ⁿ⁺¹⁾(ξ)/(n+1)! · Π(x − xᵢ) for some ξ in the node interval.' },
  ],
}
