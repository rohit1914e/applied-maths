# Mathematical Methodology

## 1. Problem statement

A latency monitor records pairs $(t_k, y_k)$: probe time in seconds and round-trip time (RTT)
in milliseconds. Some $y_k$ are missing. Given the known pairs, estimate $y$ at a missing
$t^\*$ with $t_{\min} < t^\* < t_{\max}$ (interpolation). Estimating outside the known range
(extrapolation) is out of scope and rejected by the software.

## 2. Polynomial interpolation

**Theorem (existence and uniqueness).** For $n+1$ distinct nodes $x_0,\dots,x_n$ and values
$y_0,\dots,y_n$ there is exactly one polynomial $P$ of degree $\le n$ with $P(x_i)=y_i$.

*Proof sketch.* Existence follows from the Lagrange construction below. If $P$ and $Q$ both
interpolate, $P-Q$ has degree $\le n$ and $n+1$ roots, so $P-Q\equiv 0$.

Consequence: Lagrange and Newton, given the same nodes, produce the **same polynomial**; they
differ only in representation and arithmetic cost.

**Error.** If $f$ is $n+1$ times differentiable on the node interval,

$$ f(x) - P(x) = \frac{f^{(n+1)}(\xi)}{(n+1)!}\prod_{i=0}^{n}(x-x_i). $$

The product grows quickly away from nodes and, for equally spaced nodes and large $n$, near
the ends of the interval (Runge's phenomenon). This motivates (a) a **local** window of nodes
around $t^\*$ and (b) a degree cap.

### 2.1 Lagrange form

$$ P(x) = \sum_{i=0}^{n} y_i L_i(x),\qquad L_i(x) = \prod_{j\ne i}\frac{x-x_j}{x_i-x_j}. $$

$L_i(x_j)=\delta_{ij}$, so $P(x_i)=y_i$. Also $\sum_i L_i(x)=1$ (interpolating the constant 1),
which the app displays as a check in chapter 6.

### 2.2 Newton divided differences

$$ f[x_i]=y_i,\qquad f[x_i,\dots,x_{i+k}] = \frac{f[x_{i+1},\dots,x_{i+k}] - f[x_i,\dots,x_{i+k-1}]}{x_{i+k}-x_i}. $$

$$ P(x) = a_0 + a_1(x-x_0) + a_2(x-x_0)(x-x_1) + \dots + a_n\prod_{j<n}(x-x_j),\quad a_k = f[x_0,\dots,x_k]. $$

Nested (Horner-type) evaluation: $b_n=a_n$, $b_k = a_k + (x-x_k)\,b_{k+1}$, $P(x)=b_0$.
Building the table costs $O(n^2)$; each evaluation $O(n)$; adding a node adds one coefficient.

### 2.3 Natural cubic spline

On each interval $[x_i,x_{i+1}]$, with $h_i = x_{i+1}-x_i$ and $t=x-x_i$,

$$ S_i(x) = a_i + b_i t + c_i t^2 + d_i t^3. $$

Requirements: $S$ interpolates every node; $S$, $S'$, $S''$ are continuous at interior knots;
natural boundary $S''(x_0)=S''(x_n)=0$. With $M_i = S''(x_i)$, continuity of $S'$ gives for
$i=1,\dots,n-1$

$$ h_{i-1}M_{i-1} + 2(h_{i-1}+h_i)M_i + h_iM_{i+1} = 6\left(\frac{y_{i+1}-y_i}{h_i} - \frac{y_i-y_{i-1}}{h_{i-1}}\right), $$

with $M_0=M_n=0$. The matrix is tridiagonal and strictly diagonally dominant
($2(h_{i-1}+h_i) > h_{i-1}+h_i$), hence non-singular, and the Thomas algorithm solves it in
$O(n)$ without pivoting. Then

$$ a_i=y_i,\quad b_i = \frac{y_{i+1}-y_i}{h_i} - \frac{h_i(2M_i+M_{i+1})}{6},\quad c_i=\frac{M_i}{2},\quad d_i=\frac{M_{i+1}-M_i}{6h_i}. $$

Uneven spacing is handled naturally through the $h_i$. Among all $C^2$ interpolants the natural
spline minimises $\int (S'')^2$, i.e. it is the "smoothest" curve through the data — which is why
it does not oscillate like a high-degree polynomial.

## 3. Worked example (chapter 5, computed by the app)

Known: $(1,24), (2,28), (3,31), (5,42), (7,48)$; target $t^\*=4$.

**Node window** (4 nearest, bracketing): $x = 2, 3, 5, 7$.

**Lagrange**

| i | $L_i(4)$ | $y_iL_i(4)$ |
| - | --- | --- |
| 0 | $\frac{(1)(-1)(-3)}{(-1)(-3)(-5)} = \frac{3}{-15} = -0.2$ | $-5.6$ |
| 1 | $\frac{(2)(-1)(-3)}{(1)(-2)(-4)} = \frac{6}{8} = 0.75$ | $23.25$ |
| 2 | $\frac{(2)(1)(-3)}{(3)(2)(-2)} = \frac{-6}{-12} = 0.5$ | $21$ |
| 3 | $\frac{(2)(1)(-1)}{(5)(4)(2)} = \frac{-2}{40} = -0.05$ | $-2.4$ |

$P(4) = -5.6 + 23.25 + 21 - 2.4 = 36.25$ ms.

**Newton** — divided differences:

| $x_i$ | $f[x_i]$ | 1st | 2nd | 3rd |
| --- | --- | --- | --- | --- |
| 2 | **28** | **3** | **0.8333** | **−0.2917** |
| 3 | 31 | 5.5 | −0.625 | |
| 5 | 42 | 3 | | |
| 7 | 48 | | | |

Nested at $x=4$: $b_3=-0.2917$; $b_2 = 0.8333 + (4-5)b_3 = 1.125$;
$b_1 = 3 + (4-3)b_2 = 4.125$; $b_0 = 28 + (4-2)b_1 = 36.25$ ms — identical to Lagrange.

**Natural cubic spline** (all five knots): $h = 1,1,2,2$;

$$ \begin{bmatrix}4&1&0\\1&6&2\\0&2&8\end{bmatrix}\begin{bmatrix}M_1\\M_2\\M_3\end{bmatrix} = \begin{bmatrix}-6\\15\\-15\end{bmatrix} \Rightarrow M = (0,\,-2.4643,\,3.8571,\,-2.8393,\,0). $$

$t^\*=4\in[3,5]$, $t=1$: $a=31$, $b=3.875$, $c=1.9286$, $d=-0.5580$, so
$S(4) = 31 + 3.875 + 1.9286 - 0.5580 = 36.2455$ ms.

## 4. Accuracy evaluation

Genuinely missing values cannot be checked. We therefore use **artificial masking**: start from
known values, keep them aside as ground truth, hide a subset, reconstruct from the remainder,
and compare.

$$ \text{MAE} = \frac1n\sum|y_i-\hat y_i|,\qquad \text{RMSE} = \sqrt{\frac1n\sum (y_i-\hat y_i)^2},\qquad \text{MaxAE}=\max_i|y_i-\hat y_i|. $$

RMSE ≥ MAE always, with equality only when all errors are equal; a large gap signals a few big
errors. Results are reported in milliseconds; no accuracy percentage is invented. Methods whose
RMSE differs by less than $10^{-9}$ (relative) are reported as tied — this is how the app treats
Lagrange vs Newton, which differ only by floating-point rounding.

On the default dataset (seed 2026, 48 samples, 9 hidden, 4-node window) the app computes:

| Method | MAE (ms) | RMSE (ms) | Max (ms) |
| --- | --- | --- | --- |
| Lagrange | 0.747 | 0.956 | 1.807 |
| Newton | 0.747 | 0.956 | 1.807 |
| Natural cubic spline | 0.767 | 0.962 | 1.840 |

These numbers change with the dataset; they validate the methods on these data only.

## 5. Assumptions and limitations

* The hidden value follows the local trend (smoothness). A latency spike that caused a timeout
  is invisible to any interpolant.
* No extrapolation; leading or trailing gaps stay empty.
* Polynomial windows are capped at 10 nodes (degree 9).
* Synthetic data are realistic in shape but are not real network measurements.
