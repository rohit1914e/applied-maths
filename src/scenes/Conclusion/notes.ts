import type { PresenterNotes } from '../../types/presentation'

export const conclusionNotes: PresenterNotes = {
  explain: [
    'The trace from scene 1 returns with its gaps filled: amber diamonds are reconstructed values.',
    'Summarise: problem (missing records), methods (Lagrange, Newton, natural cubic spline), evaluation (artificial masking, MAE/RMSE/max error).',
    'Limitations: interpolation assumes smoothness, cannot recover spikes hidden by a timeout, refuses extrapolation, and high-degree polynomials are unstable.',
    'Applications: monitoring dashboards, SLA reports, resampling for analysis, sensor and telemetry series in general.',
  ],
  terms: [
    { term: 'Smoothness assumption', meaning: 'the hidden value is assumed to follow the trend of its neighbours.' },
    { term: 'SLA', meaning: 'service-level agreement, often specifying latency percentiles.' },
  ],
  narration:
    'We started with a series full of holes. We built three interpolation methods from first principles, showed every intermediate step, and measured their accuracy honestly. The reconstructed values are useful estimates, clearly marked — not measurements. Thank you.',
  questions: [
    { q: 'Which method would you deploy?', a: 'The natural cubic spline for smooth series: stable at any length, no degree choice. Low-degree local polynomials are a good, cheap alternative. Use the evaluation on your own data to decide.' },
    { q: 'What would you add next?', a: 'Real ICMP collection via a local service, uncertainty bands, and comparison with statistical methods such as Kalman smoothing or Gaussian processes.' },
  ],
}
