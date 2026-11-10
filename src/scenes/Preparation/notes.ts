import type { PresenterNotes } from '../../types/presentation'

export const preparationNotes: PresenterNotes = {
  explain: [
    'Records arrive as raw text, out of time order, the way a collector receives them from several probes.',
    'Four faults are injected on purpose so validation has something to catch: a non-numeric value, a negative latency, a duplicate timestamp and a row without a timestamp.',
    'Validation applies the same cell rules as the CSV importer, row by row; rejected rows are set aside with a reason.',
    'Valid rows are sorted by timestamp, then rows with no value are marked missing. Missing rows are kept as empty slots.',
    'The result is exactly the observed dataset (a unit test checks this). Ground truth is stored separately and never enters the pipeline.',
    '"Change dataset" opens the generator (seed, size, range, missing share and pattern, irregular times) and the CSV import. Every scene recomputes.',
  ],
  terms: [
    { term: 'Validation', meaning: 'checking each record is well-formed: numeric, non-negative, timestamped, not duplicated.' },
    { term: 'Seed', meaning: 'starting value of the pseudo-random generator; same seed, same data.' },
    { term: 'Ground truth', meaning: 'the true values, kept aside only to measure accuracy later.' },
    { term: 'Data leakage', meaning: 'the method seeing the answer it should estimate; prevented by the type boundary.' },
  ],
  narration:
    'Before any mathematics, the data has to be trustworthy. Raw records come in out of order and some are broken. Watch them pass through three checks: anything malformed is rejected with a reason, the rest are put in time order, and the records with no value are marked as missing rather than dropped. What comes out is the clean dataset the algorithms will see.',
  questions: [
    { q: 'How do you prove the algorithms cannot see the hidden values?', a: 'The reconstruction function only accepts the observed dataset type, where missing rows are null. A test replaces every ground-truth value with −999 and the reconstructions do not change.' },
    { q: 'Why keep the first duplicate?', a: 'The first arrival is the original record; a later copy with a different value is treated as a fault and reported.' },
    { q: 'Why not delete the missing rows?', a: 'The time slot is real information: it tells us exactly where an estimate is needed and keeps the series regular.' },
    { q: 'Why synthetic data?', a: 'It gives exact ground truth for evaluation and is reproducible from a seed. The CSV path runs the same pipeline on real data.' },
  ],
}
