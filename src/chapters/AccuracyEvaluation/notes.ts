import type { PresenterNotes } from '../../types/presentation'

export const accuracyNotes: PresenterNotes = {
  explain: [
    'We can only measure accuracy where we know the true value. So we hide values we do know (artificial masking) and compare.',
    'Synthetic data: the hidden set is exactly the records masked in chapter 4. CSV data: genuinely missing rows are excluded; a seeded share of known interior rows is held out instead.',
    'Each method reconstructs from the observed remainder only; the truth is consulted afterwards.',
    'MAE is the average absolute error, RMSE penalises large errors more, maximum absolute error is the worst case.',
    'All numbers on screen are computed live from the algorithms and change when the dataset changes.',
  ],
  terms: [
    { term: 'MAE', meaning: '(1/n) Σ |y_i − ŷ_i|, in ms.' },
    { term: 'RMSE', meaning: '√((1/n) Σ (y_i − ŷ_i)²), in ms; always ≥ MAE.' },
    { term: 'Max absolute error', meaning: 'max |y_i − ŷ_i|: the single worst reconstruction.' },
    { term: 'Holdout', meaning: 'known values deliberately hidden to test the method.' },
  ],
  narration:
    'How do we know the reconstruction is any good? We cheat on purpose: we hide values we actually know, reconstruct them, and then compare. Here is each hidden measurement with the true value and each method’s estimate. Summarised, the errors are a few milliseconds — but note that this validates the method on these data, not any individual estimate of a value we never knew.',
  formula: 'MAE = (1/n) Σ |y_i − ŷ_i|\nRMSE = √((1/n) Σ (y_i − ŷ_i)²)\nMaxAE = max_i |y_i − ŷ_i|',
  questions: [
    { q: 'Why not report accuracy as a percentage?', a: 'A percentage would need an arbitrary tolerance. Errors in milliseconds are directly interpretable against the latency range.' },
    { q: 'Why is Lagrange identical to Newton?', a: 'Same nodes, same unique polynomial; the tiny difference, if any, is floating-point rounding.' },
    { q: 'Can you claim the estimates for real missing values are correct?', a: 'No. Masking measures typical error on similar data. A genuinely unknown value — especially behind a timeout — may differ.' },
    { q: 'Why might consecutive gaps be worse?', a: 'The nearest known nodes are further away, so the polynomial has to bridge a longer interval; the interpolation error term grows with Π(x − x_i).' },
  ],
}
