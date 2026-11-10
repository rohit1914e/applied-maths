import type { PresenterNotes } from '../../types/presentation'

export const datasetNotes: PresenterNotes = {
  explain: [
    'Synthetic data: a slow load cycle, a faster ripple, correlated jitter and a few congestion episodes, clamped to the chosen range.',
    'The seed makes generation deterministic: the same settings always give the same series, so results are reproducible in the viva.',
    'Missing percentage and pattern: random positions or consecutive bursts (2–4 records). The first and last records are never hidden, because those would need extrapolation.',
    'Two separate structures are created: the observed dataset (with gaps) and the sealed ground truth. Only the observed dataset is passed to the algorithms.',
    'CSV import: header timestamp,ping_ms. Empty, NA or "timeout" cells mark missing records. Invalid values, negative latency, duplicate or out-of-order timestamps are reported with line numbers.',
  ],
  terms: [
    { term: 'Seed', meaning: 'starting value of the pseudo-random generator (Mulberry32 here); same seed, same numbers.' },
    { term: 'Ground truth', meaning: 'the true values, kept only to measure accuracy afterwards.' },
    { term: 'Irregular sampling', meaning: 'probe times not evenly spaced; all three methods support uneven spacing.' },
    { term: 'Data leakage', meaning: 'the method seeing the answer it is supposed to estimate; prevented here by the type boundary.' },
  ],
  narration:
    'To test reconstruction we need data where we know the answer. I generate a realistic latency series from a seed, then hide a share of it. The hidden values go into a separate, sealed structure that the interpolation code never receives. If you have real measurements, the CSV importer checks every row and tells you exactly what is wrong.',
  questions: [
    { q: 'How do you prove the algorithms cannot see the hidden values?', a: 'The pipeline function accepts only the ObservedDataset type, where missing rows have observedPingMs = null. A unit test replaces every ground-truth value with −999 and shows the reconstructions are unchanged.' },
    { q: 'Why keep the endpoints?', a: 'Outside the first and last known measurement, any estimate is extrapolation. Polynomials diverge there, so the app refuses it.' },
    { q: 'Why is synthetic data acceptable?', a: 'It provides exact ground truth for evaluation. The CSV path lets the same pipeline run on real measurements.' },
  ],
}
