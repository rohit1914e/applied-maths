import type { ChapterDefinition } from '../types/presentation'
import { introductionNotes } from '../chapters/Introduction/notes'
import { transmissionNotes } from '../chapters/NetworkTransmission/notes'
import { missingDataNotes } from '../chapters/MissingData/notes'
import { datasetNotes } from '../chapters/DatasetPreparation/notes'
import { numericalMethodsNotes } from '../chapters/NumericalMethods/notes'
import { reconstructionNotes } from '../chapters/Reconstruction/notes'
import { accuracyNotes } from '../chapters/AccuracyEvaluation/notes'
import { conclusionNotes } from '../chapters/Conclusion/notes'

/** The eight chapters, in their fixed conceptual order. Components load on demand. */
export const CHAPTERS: readonly ChapterDefinition[] = [
  {
    id: 'introduction',
    number: 1,
    title: 'Understanding Network Latency',
    builds: 3,
    buildLabels: ['Latency and ping', 'Why we measure', 'The problem'],
    tone: 'light',
    notes: introductionNotes,
    load: () => import('../chapters/Introduction/Introduction'),
  },
  {
    id: 'transmission',
    number: 2,
    title: 'The Journey of a Network Packet',
    builds: 2,
    buildLabels: ['Where the time goes', 'Round-trip time'],
    tone: 'dark',
    notes: transmissionNotes,
    load: () => import('../chapters/NetworkTransmission/NetworkTransmission'),
  },
  {
    id: 'missing-data',
    number: 3,
    title: 'When Measurements Disappear',
    builds: 3,
    buildLabels: ['Reveal measurements', 'Highlight the gaps', 'Why reconstruct'],
    tone: 'light',
    notes: missingDataNotes,
    load: () => import('../chapters/MissingData/MissingData'),
  },
  {
    id: 'dataset',
    number: 4,
    title: 'Preparing the Measurements',
    builds: 0,
    buildLabels: [],
    tone: 'light',
    notes: datasetNotes,
    load: () => import('../chapters/DatasetPreparation/DatasetPreparation'),
  },
  {
    id: 'methods',
    number: 5,
    title: 'The Mathematics Behind Reconstruction',
    builds: 3,
    buildLabels: ['Construction', 'Substitution', 'Estimate'],
    tone: 'light',
    notes: numericalMethodsNotes,
    load: () => import('../chapters/NumericalMethods/NumericalMethods'),
  },
  {
    id: 'reconstruction',
    number: 6,
    title: 'Reconstructing Missing Measurements',
    builds: 0,
    buildLabels: [],
    tone: 'light',
    notes: reconstructionNotes,
    load: () => import('../chapters/Reconstruction/Reconstruction'),
  },
  {
    id: 'accuracy',
    number: 7,
    title: 'How Accurate Is Our Reconstruction?',
    builds: 3,
    buildLabels: ['Point-by-point errors', 'Error metrics', 'Interpretation'],
    tone: 'light',
    notes: accuracyNotes,
    load: () => import('../chapters/AccuracyEvaluation/AccuracyEvaluation'),
  },
  {
    id: 'conclusion',
    number: 8,
    title: 'From Missing Data to Reconstructed Measurements',
    builds: 3,
    buildLabels: ['What we built', 'Limits and uses', 'Credits'],
    tone: 'light',
    notes: conclusionNotes,
    load: () => import('../chapters/Conclusion/Conclusion'),
  },
]
