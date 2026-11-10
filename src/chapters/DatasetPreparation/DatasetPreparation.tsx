import { useId, useMemo, useState, type ChangeEvent } from 'react'
import type { ChapterProps } from '../../types/presentation'
import { ChapterFrame } from '../../components/presentation/ChapterFrame'
import { LatencyPlot } from '../../components/graphs/LatencyPlot'
import { toPlotData } from '../../components/graphs/plotData'
import { useDataset } from '../../state/DatasetContext'
import { createCsvBundle, createSyntheticBundle } from '../../data/datasets'
import { parseLatencyCsv, SAMPLE_CSV, type CsvIssue } from '../../data/csv/parseLatencyCsv'
import { DEFAULT_GENERATOR, GENERATOR_LIMITS, validateGeneratorConfig } from '../../simulation/datasetGenerator/generateDataset'
import { DEFAULT_MASK, MASK_LIMITS } from '../../simulation/missingData/missingData'
import type { DatasetBundle, GeneratorConfig, MaskConfig, MissingPattern } from '../../types/measurement'
import { fmt } from '../../utils/format'

type Mode = 'synthetic' | 'csv'

interface FormState {
  sampleCount: string
  minLatencyMs: string
  maxLatencyMs: string
  seed: string
  missingPercent: string
  maskSeed: string
  pattern: MissingPattern
  irregularSampling: boolean
}

function toForm(bundle: DatasetBundle): FormState {
  const g = bundle.source.type === 'synthetic' ? bundle.source.generator : DEFAULT_GENERATOR
  const m = bundle.source.type === 'synthetic' ? bundle.source.mask : DEFAULT_MASK
  return {
    sampleCount: String(g.sampleCount),
    minLatencyMs: String(g.minLatencyMs),
    maxLatencyMs: String(g.maxLatencyMs),
    seed: String(g.seed),
    missingPercent: String(m.missingPercent),
    maskSeed: String(m.seed),
    pattern: m.pattern,
    irregularSampling: g.irregularSampling,
  }
}

export default function DatasetPreparation(_props: ChapterProps) {
  const { bundle, setBundle } = useDataset()
  const [mode, setMode] = useState<Mode>(bundle.source.type)
  const [form, setForm] = useState<FormState>(() => toForm(bundle))
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [csvErrors, setCsvErrors] = useState<readonly CsvIssue[]>([])
  const [csvWarnings, setCsvWarnings] = useState<readonly CsvIssue[]>([])
  const [csvMessage, setCsvMessage] = useState<string | null>(null)
  const fileId = useId()

  const stats = useMemo(() => {
    const ms = bundle.observed.measurements
    const values = ms.flatMap((m) => (m.observedPingMs === null ? [] : [m.observedPingMs]))
    const gaps = ms.slice(1).map((m, i) => m.timestamp - ms[i].timestamp)
    const regular = gaps.every((g) => Math.abs(g - gaps[0]) < 1e-9)
    return {
      total: ms.length,
      observed: values.length,
      missing: bundle.missingIndices.length,
      min: Math.min(...values),
      max: Math.max(...values),
      regular,
      truthCount: bundle.groundTruth.values.size,
    }
  }, [bundle])

  const update = (key: keyof FormState) => (e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const generate = () => {
    const generator: GeneratorConfig = {
      sampleCount: Number(form.sampleCount),
      minLatencyMs: Number(form.minLatencyMs),
      maxLatencyMs: Number(form.maxLatencyMs),
      seed: Number(form.seed),
      irregularSampling: form.irregularSampling,
    }
    const mask: MaskConfig = { missingPercent: Number(form.missingPercent), pattern: form.pattern, seed: Number(form.maskSeed) }
    const errors = validateGeneratorConfig(generator)
    if (!Number.isFinite(mask.missingPercent) || mask.missingPercent < MASK_LIMITS.minPercent || mask.missingPercent > MASK_LIMITS.maxPercent) {
      errors.push(`Missing share must be between ${MASK_LIMITS.minPercent} and ${MASK_LIMITS.maxPercent} %.`)
    }
    if (!Number.isInteger(mask.seed) || mask.seed < 0) errors.push('Mask seed must be a non-negative whole number.')
    setFormErrors(errors)
    if (errors.length === 0) setBundle(createSyntheticBundle(generator, mask))
  }

  const loadCsvText = (text: string, fileName: string) => {
    const result = parseLatencyCsv(text)
    if (!result.ok) {
      setCsvErrors(result.errors)
      setCsvWarnings([])
      setCsvMessage(`${fileName} was not loaded. Fix the rows below and try again.`)
      return
    }
    setCsvErrors([])
    setCsvWarnings(result.warnings)
    setCsvMessage(`Loaded ${fileName}: ${result.rows.length} rows, ${result.missingCount} without a value.`)
    setBundle(createCsvBundle(fileName, result.rows))
  }

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 5_000_000) {
      setCsvErrors([{ line: null, message: 'The file is larger than 5 MB. Use a shorter extract.' }])
      return
    }
    loadCsvText(await file.text(), file.name)
  }

  return (
    <ChapterFrame
      number={4}
      title="Preparing the Measurements"
      lede="Testing needs a series where the answer is known. Generate one from a seed, or import your own pings."
    >
      <div className="grid h-full grid-cols-[540px_1fr] gap-x-[56px]">
        {/* controls */}
        <div className="flex min-h-0 flex-col">
          <div className="segmented self-start" role="tablist" aria-label="Data source">
            {(['synthetic', 'csv'] as const).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}>
                {m === 'synthetic' ? 'Generate synthetic data' : 'Import CSV'}
              </button>
            ))}
          </div>

          {mode === 'synthetic' ? (
            <form
              className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                generate()
              }}
              aria-label="Synthetic dataset settings"
            >
              <Field label="Samples" hint={`${GENERATOR_LIMITS.sampleCount.min}–${GENERATOR_LIMITS.sampleCount.max}`} value={form.sampleCount} onChange={update('sampleCount')} />
              <Field label="Generator seed" value={form.seed} onChange={update('seed')} />
              <Field label="Minimum latency (ms)" value={form.minLatencyMs} onChange={update('minLatencyMs')} />
              <Field label="Maximum latency (ms)" value={form.maxLatencyMs} onChange={update('maxLatencyMs')} />
              <Field label="Missing share (%)" hint={`0–${MASK_LIMITS.maxPercent}`} value={form.missingPercent} onChange={update('missingPercent')} />
              <Field label="Mask seed" value={form.maskSeed} onChange={update('maskSeed')} />

              <fieldset className="col-span-2">
                <legend className="field-label">Missing positions</legend>
                <div className="segmented mt-1.5">
                  {(['random', 'consecutive'] as const).map((p) => (
                    <button key={p} type="button" aria-pressed={form.pattern === p} onClick={() => setForm((f) => ({ ...f, pattern: p }))}>
                      {p === 'random' ? 'Random' : 'Consecutive bursts'}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="col-span-2 flex items-center gap-3 text-[21px]">
                <input
                  type="checkbox"
                  className="h-6 w-6 accent-[#633f32]"
                  checked={form.irregularSampling}
                  onChange={(e) => setForm((f) => ({ ...f, irregularSampling: e.target.checked }))}
                />
                Irregular probe times (uneven spacing)
              </label>

              <div className="col-span-2 mt-1 flex gap-3">
                <button type="submit" className="btn">
                  Generate dataset
                </button>
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => setForm((f) => ({ ...f, seed: String(Number(f.seed || 0) + 1) }))}
                >
                  Next seed
                </button>
              </div>
              {formErrors.length > 0 && (
                <ul role="alert" className="col-span-2 space-y-1 text-[19px] font-semibold text-crimson">
                  {formErrors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}
            </form>
          ) : (
            <div className="mt-6 flex min-h-0 flex-col">
              <p className="small-copy text-muted">
                Two columns with a header: <code className="num text-charcoal">timestamp,ping_ms</code>. Timestamps in seconds, increasing. Leave a latency cell empty (or write NA or timeout) for a missing measurement.
              </p>
              <div className="mt-4 flex gap-3">
                <label htmlFor={fileId} className="btn">
                  Choose CSV file
                </label>
                <input id={fileId} type="file" accept=".csv,text/csv" className="sr-only" onChange={onFile} data-testid="csv-input" />
                <button type="button" className="btn btn-quiet" onClick={() => loadCsvText(SAMPLE_CSV, 'sample.csv')}>
                  Load sample CSV
                </button>
              </div>
              {csvMessage && (
                <p className={`mt-4 text-[20px] font-semibold ${csvErrors.length ? 'text-crimson' : 'text-brown'}`} role="status">
                  {csvMessage}
                </p>
              )}
              {csvErrors.length > 0 && (
                <ul role="alert" className="num mt-2 max-h-[300px] space-y-1 overflow-y-auto text-[18px] text-crimson" data-testid="csv-errors">
                  {csvErrors.map((e, i) => (
                    <li key={i}>
                      {e.line !== null ? `Line ${e.line}: ` : ''}
                      <span className="font-sans">{e.message}</span>
                    </li>
                  ))}
                </ul>
              )}
              {csvWarnings.map((w) => (
                <p key={w.message} className="mt-2 text-[18px] text-amber-ink">
                  {w.message}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* the active dataset */}
        <div className="flex min-w-0 flex-col">
          <div className="flex items-baseline justify-between">
            <h2 className="section-heading">Active dataset</h2>
            <p className="text-[20px] text-muted" data-testid="dataset-label">
              {bundle.source.type === 'synthetic' ? `Synthetic, seed ${bundle.source.generator.seed}` : `Imported from ${bundle.source.fileName}`}
            </p>
          </div>
          <div className="mt-2">
            <LatencyPlot width={1116} height={350} data={toPlotData(bundle.observed.measurements)} label="Active dataset with missing records" />
          </div>

          <dl className="mt-3 grid grid-cols-5 border-y-2 border-rule py-3" data-testid="dataset-stats">
            <Stat label="Records" value={String(stats.total)} />
            <Stat label="Observed" value={String(stats.observed)} />
            <Stat label="Missing" value={String(stats.missing)} accent />
            <Stat label="Observed range" value={`${fmt(stats.min, 1)}–${fmt(stats.max, 1)}`} />
            <Stat label="Spacing" value={stats.regular ? 'regular' : 'irregular'} text />
          </dl>

          <div className="mt-5 grid grid-cols-2 gap-6 text-[20px] leading-snug">
            <div className="border-l-4 border-brown pl-4">
              <p className="font-semibold">Observed dataset</p>
              <p className="text-muted">
                {stats.observed} known values, {stats.missing} empty slots. This is the only input the interpolation code receives.
              </p>
            </div>
            <div className="border-l-4 border-crimson pl-4">
              <p className="font-semibold">Ground truth, sealed</p>
              <p className="text-muted">
                {stats.truthCount} reference values kept separately, used only to score accuracy in chapter 7.
                {bundle.source.type === 'csv' && stats.missing > 0 && ' Rows that were empty in the file have no reference value.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </ChapterFrame>
  )
}

function Field({ label, hint, value, onChange }: { label: string; hint?: string; value: string; onChange: (e: ChangeEvent<HTMLInputElement>) => void }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
        {hint && <span className="num ml-2 font-normal">{hint}</span>}
      </label>
      <input id={id} className="field-input mt-1" inputMode="decimal" value={value} onChange={onChange} />
    </div>
  )
}

function Stat({ label, value, accent = false, text = false }: { label: string; value: string; accent?: boolean; text?: boolean }) {
  return (
    <div>
      <dt className="text-[17px] text-muted">{label}</dt>
      <dd className={`${text ? 'font-sans' : 'num'} mt-0.5 text-[28px] ${accent ? 'text-crimson' : 'text-charcoal'}`}>{value}</dd>
    </div>
  )
}
