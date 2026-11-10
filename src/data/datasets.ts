import { generateLatencySeries, DEFAULT_GENERATOR } from '../simulation/datasetGenerator/generateDataset'
import { buildBundle, DEFAULT_MASK, generateMissingIndices } from '../simulation/missingData/missingData'
import type { DatasetBundle, GeneratorConfig, MaskConfig } from '../types/measurement'
import type { CsvRow } from './csv/parseLatencyCsv'

export function createSyntheticBundle(generator: GeneratorConfig = DEFAULT_GENERATOR, mask: MaskConfig = DEFAULT_MASK): DatasetBundle {
  const series = generateLatencySeries(generator)
  const missing = generateMissingIndices(series.pingMs.length, mask)
  return buildBundle(
    { type: 'synthetic', generator, mask },
    series.timestamps,
    series.pingMs,
    missing,
    `Synthetic · seed ${generator.seed}`,
  )
}

/** CSV rows become the observed dataset; empty cells are genuinely missing (no ground truth). */
export function createCsvBundle(fileName: string, rows: readonly CsvRow[]): DatasetBundle {
  const t0 = rows[0].timestamp
  return buildBundle(
    { type: 'csv', fileName },
    rows.map((r) => Math.round((r.timestamp - t0) * 1e6) / 1e6),
    rows.map((r) => r.pingMs),
    [],
    fileName,
  )
}

/** Chapter 3's illustrative timeline; values are example data, not algorithm output. */
export const TIMELINE_EXAMPLE: readonly { t: number; ping: number | null }[] = [
  { t: 1, ping: 24 },
  { t: 2, ping: 28 },
  { t: 3, ping: 31 },
  { t: 4, ping: null },
  { t: 5, ping: 42 },
  { t: 6, ping: null },
  { t: 7, ping: 48 },
]
