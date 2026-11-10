import { useMemo } from 'react'
import { DatasetControls } from '../../components/data/DatasetControls'
import { buildRawStream, runPreparationPipeline } from '../../data/preparation/preparationPipeline'
import { useDataset } from '../../state/DatasetContext'
import { fmt, fmtSeconds } from '../../utils/format'
import { Section } from '../Section'

export function DatasetSection() {
  const { bundle } = useDataset()
  const ms = bundle.observed.measurements
  const prep = useMemo(() => runPreparationPipeline(buildRawStream(bundle.observed)), [bundle])
  const observed = ms.filter((m) => m.status === 'observed')
  const values = observed.map((m) => m.observedPingMs as number)
  const gaps = ms.slice(1).map((m, i) => m.timestamp - ms[i].timestamp)
  const regular = gaps.every((g) => Math.abs(g - gaps[0]) < 1e-9)

  const steps = [
    { title: 'Arrive', value: prep.arrivals.length, text: 'raw records in network order' },
    { title: 'Validate', value: prep.rejected.length, text: 'rejected with a reason', alert: true },
    { title: 'Sort', value: prep.sorted.length, text: 'valid records in time order' },
    { title: 'Identify missing', value: prep.missingIds.size, text: 'kept as empty slots', alert: true },
  ]

  return (
    <Section
      id="dataset"
      title="The dataset"
      intro="Measurements pass through validation and preprocessing before any mathematics. The table is exactly what the interpolation code receives; the true values of missing records are stored separately and used only to score accuracy."
    >
      <div className="grid grid-cols-1 [&>*]:min-w-0 gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start">
        <div className="card flex min-h-0 flex-col p-0" data-reveal>
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
            <p className="font-semibold">{bundle.source.type === 'synthetic' ? `Synthetic, seed ${bundle.source.generator.seed}` : `Imported: ${bundle.source.fileName}`}</p>
            <p className="text-sm text-muted" data-testid="dataset-summary">
              {ms.length} records, {observed.length} observed, <span className="text-missing-ink">{bundle.missingIndices.length} missing</span>, {fmt(Math.min(...values), 1)}–{fmt(Math.max(...values), 1)} ms, {regular ? 'regular' : 'irregular'} spacing
            </p>
          </div>
          <div className="max-h-[640px] overflow-auto" tabIndex={0} aria-label="Dataset table">
            <table className="w-full text-sm" data-testid="dataset-table">
              <thead className="sticky top-0 bg-canvas text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-2 font-semibold sm:px-5">#</th>
                  <th className="px-3 py-2 text-right font-semibold">Timestamp (s)</th>
                  <th className="px-3 py-2 text-right font-semibold">Ping (ms)</th>
                  <th className="px-4 py-2 font-semibold sm:px-5">Status</th>
                </tr>
              </thead>
              <tbody>
                {ms.map((m) => (
                  <tr key={m.index} className={`border-t border-line ${m.status === 'missing' ? 'bg-missing-soft' : ''}`}>
                    <td className="num px-4 py-1.5 text-muted sm:px-5">{m.index + 1}</td>
                    <td className="num px-3 py-1.5 text-right">{fmtSeconds(m.timestamp)}</td>
                    <td className="num px-3 py-1.5 text-right">{m.observedPingMs === null ? '—' : fmt(m.observedPingMs, 1)}</td>
                    <td className="px-4 py-1.5 sm:px-5">
                      {m.status === 'missing' ? (
                        <span className="badge bg-missing-soft text-missing-ink">
                          <span className="h-1.5 w-1.5 rounded-full bg-missing" /> Missing
                        </span>
                      ) : (
                        <span className="badge bg-accent-soft text-accent">
                          <span className="h-1.5 w-1.5 rounded-full bg-actual" /> Observed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="card p-4 sm:p-5" data-reveal>
            <p className="mb-3 font-semibold">Data source</p>
            <DatasetControls />
          </div>

          <div className="card p-4 sm:p-5" data-reveal data-testid="preprocessing">
            <p className="font-semibold">Validation and preprocessing</p>
            <p className="mt-1 text-sm text-muted">The records are replayed as a raw stream, out of order and with four injected faults, and run through the pipeline.</p>
            <ol className="mt-4 grid grid-cols-1 [&>*]:min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
              {steps.map((st, i) => (
                <li key={st.title} className="rounded-lg bg-canvas p-3">
                  <p className="text-xs text-muted">
                    <span className="num mr-1 font-semibold text-accent">{i + 1}</span>
                    {st.title}
                  </p>
                  <p className={`num mt-1 text-xl ${st.alert ? 'text-missing-ink' : ''}`}>{st.value}</p>
                  <p className="text-xs leading-snug text-muted">{st.text}</p>
                </li>
              ))}
            </ol>
            <table className="mt-4 w-full text-sm" data-testid="rejected-rows">
              <caption className="pb-1 text-left text-xs font-semibold text-muted">Rejected rows</caption>
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="py-1 font-semibold">Timestamp</th>
                  <th className="py-1 font-semibold">Ping</th>
                  <th className="py-1 font-semibold">Reason</th>
                </tr>
              </thead>
              <tbody>
                {prep.rejected.map((r) => (
                  <tr key={r.record.id} className="border-b border-line last:border-0">
                    <td className="num py-1">{r.record.timestamp || '—'}</td>
                    <td className="num py-1 text-missing-ink">{r.record.ping || '—'}</td>
                    <td className="py-1 text-muted">{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted">
              The cleaned output matches the table exactly: {prep.sorted.length} records, {prep.missingIds.size} without a value.
            </p>
          </div>
        </div>
      </div>
    </Section>
  )
}
