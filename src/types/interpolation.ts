/** A known coordinate (x = timestamp in seconds, y = latency in milliseconds). */
export interface Point {
  readonly x: number
  readonly y: number
}

export type InterpolationMethod = 'lagrange' | 'newton' | 'spline'

export const METHOD_LABELS: Record<InterpolationMethod, string> = {
  lagrange: 'Lagrange',
  newton: 'Newton divided differences',
  spline: 'Natural cubic spline',
}

export const METHOD_SHORT_LABELS: Record<InterpolationMethod, string> = {
  lagrange: 'Lagrange',
  newton: 'Newton',
  spline: 'Cubic spline',
}

export const METHODS: readonly InterpolationMethod[] = ['lagrange', 'newton', 'spline']

// ---------- Lagrange ----------

export interface LagrangeFactor {
  /** index j of the other node */
  readonly j: number
  readonly xj: number
  /** x − x_j */
  readonly numerator: number
  /** x_i − x_j */
  readonly denominator: number
  readonly ratio: number
}

export interface LagrangeBasisStep {
  readonly i: number
  readonly xi: number
  readonly yi: number
  readonly factors: readonly LagrangeFactor[]
  /** L_i(x) */
  readonly basisValue: number
  /** y_i · L_i(x) */
  readonly term: number
}

export interface LagrangeResult {
  readonly method: 'lagrange'
  readonly x: number
  readonly value: number
  readonly nodes: readonly Point[]
  readonly basis: readonly LagrangeBasisStep[]
}

// ---------- Newton ----------

export interface NestedStep {
  /** coefficient index k (a_k) */
  readonly k: number
  readonly coefficient: number
  /** (x − x_k) used to multiply the running value, null for the first step */
  readonly multiplier: number | null
  readonly accumulated: number
}

export interface NewtonResult {
  readonly method: 'newton'
  readonly x: number
  readonly value: number
  readonly nodes: readonly Point[]
  /** table[k][i] = f[x_i, …, x_{i+k}] */
  readonly table: readonly (readonly number[])[]
  /** a_k = f[x_0, …, x_k] */
  readonly coefficients: readonly number[]
  /** Horner-style evaluation from the highest coefficient down */
  readonly nested: readonly NestedStep[]
}

// ---------- Natural cubic spline ----------

/** S_i(x) = a + b·t + c·t² + d·t³ with t = x − x0, valid on [x0, x1]. */
export interface SplineSegment {
  readonly x0: number
  readonly x1: number
  readonly a: number
  readonly b: number
  readonly c: number
  readonly d: number
}

/** Tridiagonal system for interior second derivatives M_1 … M_{n−2}. */
export interface TridiagonalSystem {
  readonly lower: readonly number[]
  readonly diagonal: readonly number[]
  readonly upper: readonly number[]
  readonly rhs: readonly number[]
}

export interface NaturalCubicSpline {
  readonly nodes: readonly Point[]
  readonly h: readonly number[]
  readonly system: TridiagonalSystem
  /** M_i = S″(x_i); M_0 = M_n = 0 (natural boundary) */
  readonly secondDerivatives: readonly number[]
  readonly segments: readonly SplineSegment[]
  evaluate(x: number): number
  derivative(x: number, order: 1 | 2): number
  segmentIndexFor(x: number): number
}

export interface SplineResult {
  readonly method: 'spline'
  readonly x: number
  readonly value: number
  readonly nodes: readonly Point[]
  readonly spline: NaturalCubicSpline
  readonly segmentIndex: number
  readonly segment: SplineSegment
  /** local coordinate x − x_i */
  readonly t: number
  /** the four terms a, b·t, c·t², d·t³ */
  readonly terms: readonly [number, number, number, number]
}

export type MethodResult = LagrangeResult | NewtonResult | SplineResult
