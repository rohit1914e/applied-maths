# Algorithm Implementation

All algorithms are plain TypeScript functions under `src/algorithms/` with no UI dependencies.
Each returns its intermediate values so the presentation can show them.

## Shared validation — `shared/validation.ts`

| Check | Error code | When |
| --- | --- | --- |
| Too few nodes | `INSUFFICIENT_NODES` | fewer than 2 (polynomials, spline) |
| Non-finite x or y | `NON_FINITE` | NaN / ±Infinity in nodes or query |
| Duplicate x | `DUPLICATE_NODES` | two nodes closer than the node tolerance |
| Extrapolation | `EXTRAPOLATION` | query outside [x_min, x_max] beyond the domain tolerance |
| Degree cap | `DEGREE_TOO_HIGH` | more than 10 nodes in a Lagrange/Newton polynomial |

`validateNodes` returns a **sorted copy**; inputs are never mutated.

### Tolerances

| Constant | Value | Meaning |
| --- | --- | --- |
| `NODE_ABSOLUTE` | 1e-12 | absolute part of the duplicate-node test |
| `NODE_RELATIVE` | 1e-9 | relative part: `|a−b| ≤ 1e-12 + 1e-9·max(|a|,|b|)` means "same node" |
| `DOMAIN` | 1e-9 | slack (scaled by max(1, |end node|)) before a query counts as extrapolation |
| `MAX_POLYNOMIAL_NODES` | 10 | degree ≤ 9 |
| `RMSE_TIE_TOLERANCE` | 1e-9 | relative RMSE difference treated as a tie in rankings |

The duplicate test guarantees that every Lagrange denominator $(x_i-x_j)$, every divided-difference
denominator $(x_{i+k}-x_i)$ and every spline width $h_i$ is non-zero — there is no division by zero.

## Node selection — `nodeSelection.ts`

`selectNodesAround(known, x, count)`:
1. Split known points into left (`< x`, nearest first) and right (`> x`, nearest first).
2. Reject if either side is empty (would be extrapolation).
3. Take the nearest on each side, then repeatedly the closer of the next left/right candidate.
   Ties go to the side with fewer chosen nodes, then to the left — deterministic.
4. Return sorted by x. If fewer known points exist than requested, all are used.

Lagrange and Newton always call this with the same arguments, so they receive identical nodes.

## Lagrange — `lagrange/lagrange.ts`

`lagrangeInterpolate(nodes, x)` → `{ value, nodes, basis[] }`, where each basis entry records
every factor `(x − x_j)/(x_i − x_j)`, the basis value $L_i(x)$ and the term $y_iL_i(x)$.
Complexity $O(n^2)$ per query. `lagrangePolynomial(nodes)` returns a closure for plotting.

## Newton — `newton/newton.ts`

`dividedDifferenceTable(nodes)` builds `table[k][i] = f[x_i..x_{i+k}]` column by column ($O(n^2)$).
`newtonInterpolate(nodes, x)` → `{ value, table, coefficients, nested[] }`; `nested` lists each
Horner step $b_k = a_k + (x-x_k)b_{k+1}$. `newtonPolynomial` returns a plotting closure.

## Natural cubic spline — `cubicSpline/naturalCubicSpline.ts`

`buildNaturalCubicSpline(nodes)`:
1. Validate and sort; compute $h_i$.
2. Assemble the $(n-1)\times(n-1)$ tridiagonal system (`lower`, `diagonal`, `upper`, `rhs`).
3. Solve with the Thomas algorithm (forward sweep, back substitution), $O(n)$.
4. Pad with $M_0 = M_n = 0$; compute $a_i, b_i, c_i, d_i$ per segment.
5. Return `evaluate(x)`, `derivative(x, 1|2)` and `segmentIndexFor(x)` (binary search; the last
   node belongs to the last segment).

With two nodes the system is empty and the spline is the straight line through them.
`splineInterpolate(nodes, x, prebuilt?)` reports the segment, local $t$, and the four terms.
In reconstruction the spline is built once over all observed points and reused for every gap.

## Reconstruction pipeline — `src/reconstruction/reconstruct.ts`

```
reconstruct(observed: ObservedDataset, indices, { method, nodeCount }) → ReconstructionOutcome[]
```

* Known points = rows with `status === 'observed'` only (never reconstructed values).
* Spline: one global spline over all known points. Polynomials: a local window of `nodeCount`
  nodes (default 4, cubic), clamped to [2, 10].
* Interpolation errors become `{ ok: false, reason }` outcomes (shown to the user), never
  silent drops. Unexpected errors are re-thrown.
* `sampleCurve(outcome)` samples the interpolant only between the first and last node used.

## Evaluation — `src/evaluation/`

`computeErrorMetrics(pairs)` returns `{ n, mae, rmse, maxAbsError, maxAbsErrorAt }` and throws
`EvaluationError` for an empty set or any non-finite value.

`planExperiment(bundle, holdoutPercent, seed)` builds the reference series (rows with ground
truth) and the hidden set: the scene 3 mask for synthetic data; a seeded holdout of interior
known rows for CSV data. `runAccuracyExperiment` masks, reconstructs from the observed remainder
via the same pipeline, then compares with truth. `rankByRmse` orders methods with tie tolerance.

## Numerical stability notes

* Local windows keep the polynomial degree low (default 3); the cap prevents degree > 9.
* The Lagrange form is evaluated directly, which is fine for ≤ 10 nodes; the barycentric form
  would be preferred for large n but is not needed under the cap.
* Timestamps from CSV files are shifted to start at 0, which avoids catastrophic cancellation
  in $(x - x_j)$ for epoch-second timestamps (~1.7 × 10⁹).
* The spline system's diagonal dominance makes the Thomas algorithm stable without pivoting.
