import type { SceneDefinition } from '../types/presentation'
import { liveNetworkNotes } from '../scenes/LiveNetwork/notes'
import { missingDataNotes } from '../scenes/MissingData/notes'
import { preparationNotes } from '../scenes/Preparation/notes'
import { interpolationNotes } from '../scenes/Interpolation/notes'
import { reconstructionNotes } from '../scenes/Reconstruction/notes'
import { accuracyNotes } from '../scenes/Accuracy/notes'
import { conclusionNotes } from '../scenes/Conclusion/notes'
import { stageEndProgress } from '../scenes/Preparation/timing'
import { PHASES } from '../scenes/Interpolation/timing'

/**
 * The story, in order. `length` is scroll distance in screens; `beats` are where Space and
 * the arrow keys stop. A beat's `seconds` is how long the keyboard step takes to get there,
 * so constructions play at a readable pace instead of jumping.
 */
export const SCENES: readonly SceneDefinition[] = [
  {
    id: 'live-network',
    number: 1,
    title: 'Understanding Network Latency',
    length: 3,
    beats: [
      { at: 0, label: 'A live network' },
      { at: 0.5, label: 'Where the time goes', seconds: 1.4 },
      { at: 1, label: 'Replies that never arrive', seconds: 1.4 },
    ],
    notes: liveNetworkNotes,
    load: () => import('../scenes/LiveNetwork/LiveNetwork'),
  },
  {
    id: 'missing-data',
    number: 2,
    title: 'When Measurements Disappear',
    length: 4,
    beats: [
      { at: 0, label: 'Recording begins' },
      { at: 0.32, label: 'The series builds', seconds: 3.5 },
      { at: 0.53, label: 'Measurements disappear', seconds: 2.4 },
      { at: 0.62, label: 'Why gaps matter', seconds: 1 },
      { at: 0.86, label: 'Why records go missing', seconds: 1 },
    ],
    notes: missingDataNotes,
    load: () => import('../scenes/MissingData/MissingData'),
  },
  {
    id: 'preparation',
    number: 3,
    title: 'Preparing the Measurements',
    length: 4.5,
    beats: [
      { at: 0, label: 'Raw records' },
      { at: stageEndProgress(0), label: 'Records arrive', seconds: 2.4 },
      { at: stageEndProgress(1), label: 'Validation', seconds: 2.8 },
      { at: stageEndProgress(2), label: 'Sorted by time', seconds: 2.4 },
      { at: stageEndProgress(3), label: 'Missing identified', seconds: 2 },
      { at: 1, label: 'Clean dataset', seconds: 2 },
    ],
    notes: preparationNotes,
    load: () => import('../scenes/Preparation/Preparation'),
  },
  {
    id: 'interpolation',
    number: 4,
    title: 'The Mathematics of Reconstruction',
    length: 7,
    beats: [
      { at: 0, label: 'Zoom into one gap' },
      { at: PHASES.lagrange[0], label: 'Lagrange', seconds: 0.8 },
      { at: PHASES.lagrange[1] + 0.01, label: 'Lagrange estimate', seconds: 5 },
      { at: PHASES.newton[0], label: 'Newton', seconds: 0.8 },
      { at: PHASES.newton[1] + 0.01, label: 'Newton estimate', seconds: 5 },
      { at: PHASES.spline[0], label: 'Cubic spline', seconds: 0.8 },
      { at: PHASES.spline[1] + 0.01, label: 'Spline estimate', seconds: 5 },
      { at: 0.9, label: 'Compare the methods', seconds: 1 },
    ],
    notes: interpolationNotes,
    load: () => import('../scenes/Interpolation/Interpolation'),
  },
  {
    id: 'reconstruction',
    number: 5,
    title: 'Reconstructing Missing Measurements',
    length: 4.5,
    beats: [
      { at: 0, label: 'The gaps' },
      { at: 0.87, label: 'Every gap estimated', seconds: 9 },
      { at: 1, label: 'Measured versus estimated', seconds: 0.8 },
    ],
    notes: reconstructionNotes,
    load: () => import('../scenes/Reconstruction/Reconstruction'),
  },
  {
    id: 'accuracy',
    number: 6,
    title: 'How Accurate Is Our Reconstruction?',
    length: 4.5,
    beats: [
      { at: 0, label: 'Hidden truth' },
      { at: 0.57, label: 'Errors, one by one', seconds: 7 },
      { at: 0.77, label: 'All three methods', seconds: 1.8 },
      { at: 0.88, label: 'What it means', seconds: 1 },
    ],
    notes: accuracyNotes,
    load: () => import('../scenes/Accuracy/Accuracy'),
  },
  {
    id: 'conclusion',
    number: 7,
    title: 'From Missing Data to Reconstructed Measurements',
    length: 3.5,
    beats: [
      { at: 0, label: 'The gaps' },
      { at: 0.25, label: 'The completed series', seconds: 2.5 },
      { at: 0.4, label: 'What we built', seconds: 0.8 },
      { at: 0.7, label: 'Limits and uses', seconds: 1 },
      { at: 1, label: 'Credits', seconds: 1 },
    ],
    notes: conclusionNotes,
    load: () => import('../scenes/Conclusion/Conclusion'),
  },
]
