# Viva Questions and Model Answers

## Concepts

**What is latency and how is RTT measured?**
The delay for data to cross the network. Ping sends an ICMP Echo Request and records the time
until the Echo Reply arrives at the sender: RTT = t_reply − t_request, measured on one clock.

**Is a missing ping record the same as packet loss?**
No. A gap only means nothing was stored. Causes include a failed probe, a reply after the
timeout, or a collector/database error. Packet loss is one possible cause.

**Why not just drop missing records?**
Averages and percentiles become biased, charts and rate-of-change calculations break, and many
tools expect one value per interval.

## Interpolation

**Define interpolation versus extrapolation.**
Interpolation estimates inside the range of known x; extrapolation outside it. The app rejects
extrapolation because polynomial behaviour outside the nodes is uncontrolled.

**Why do Lagrange and Newton give the same answer?**
Uniqueness theorem: through n+1 distinct nodes there is exactly one polynomial of degree ≤ n.
Lagrange and Newton are two representations of it. In the app any difference is at the 10⁻¹⁵ level
(floating-point rounding), so they are reported as a tie.

**Then why implement both?**
They are different algorithms with different costs and properties: Newton allows adding a node
with one new coefficient and evaluates in O(n) by nested multiplication; Lagrange exposes the
weight of each measurement directly.

**What is Runge's phenomenon and how do you handle it?**
High-degree polynomials through equally spaced nodes oscillate near the interval ends. We use a
local window (default 4 nodes, cubic) and cap at 10 nodes. The spline avoids it by being
piecewise cubic.

**State the interpolation error formula.**
f(x) − P(x) = f⁽ⁿ⁺¹⁾(ξ)/(n+1)! · Π(x − xᵢ) for some ξ in the node interval.

**What does "natural" mean in natural cubic spline?**
The second derivative is zero at both end nodes: M₀ = Mₙ = 0.

**How many conditions determine a cubic spline?**
n intervals × 4 coefficients = 4n unknowns. Interpolation gives 2n, continuity of S′ and S″ at
n−1 interior knots gives 2(n−1), and the two natural boundary conditions complete 4n.

**How do you solve for the spline?**
The second-derivative system is tridiagonal and strictly diagonally dominant, so the Thomas
algorithm solves it in O(n) without pivoting.

**Do your methods support uneven spacing?**
Yes. Lagrange and Newton use actual x differences; the spline uses hᵢ = xᵢ₊₁ − xᵢ. Chapter 4 can
generate irregular probe times.

**How do you avoid division by zero?**
Nodes closer than 10⁻¹² + 10⁻⁹·|x| are rejected as duplicates, so no denominator (xᵢ − xⱼ), no
divided-difference denominator and no hᵢ can be zero.

**Which nodes do Lagrange and Newton use?**
The k known points nearest the target with at least one on each side; ties broken
deterministically. Both methods receive the identical window.

## Data and evaluation

**How do you know the algorithm cannot see the hidden values?**
The pipeline only accepts the ObservedDataset type, whose missing rows have observedPingMs = null;
the truth lives in a separate GroundTruth map. A test overwrites all truth with −999 and the
reconstructions do not change.

**How did you evaluate accuracy?**
Artificial masking: hide known values, reconstruct from the remainder, compare with the hidden
truth, and compute MAE, RMSE and maximum absolute error in ms.

**Why RMSE as well as MAE?**
RMSE squares errors, so it penalises large errors; RMSE ≥ MAE, and a large gap indicates a few
big misses.

**Why no accuracy percentage?**
It would need an arbitrary tolerance. Errors in milliseconds are directly interpretable.

**Can you claim your estimate of a truly missing value is correct?**
No. Masking measures typical error on comparable data. A value hidden by a timeout may have been
a spike that no interpolant can recover.

**Which method was best?**
On the default dataset Lagrange/Newton (RMSE 0.956 ms) and the spline (0.962 ms) are almost equal.
It depends on the data; the app computes it live, which is the honest answer.

**Why are consecutive gaps harder?**
The nearest nodes are further away, so Π(x − xᵢ) grows and the estimate relies more on the
assumed shape.

## Implementation

**Why synthetic data?**
It provides exact ground truth for evaluation and a reproducible seed. The CSV importer runs the
same pipeline on real data.

**Is the packet animation a real ping?**
No — a seeded simulation of propagation, transmission and queuing delays. Real ICMP requires
privileged sockets and is listed as a future extension.

**How did you test the software?**
72 Vitest unit/component tests (numerical properties, isolation, CSV validation, metrics, UI
behaviour) and 12 Playwright end-to-end tests (navigation, fullscreen, notes, demos, responsive
layout), plus lint, type-check and a production build. See TEST_REPORT.md.

**What would you add next?**
A local service for real ICMP collection, uncertainty bands for estimates, and comparison with
statistical methods such as Kalman smoothing or Gaussian-process regression.
