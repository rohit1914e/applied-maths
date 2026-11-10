import { useMemo, useRef, useState } from 'react'
import { LatencyPlot, type PlotMeasurement } from '../../components/graphs/LatencyPlot'
import { useConstruction } from '../../hooks/useConstruction'
import { useFirstView } from '../../hooks/useViewport'
import { useDataset } from '../../state/DatasetContext'
import { fmt } from '../../utils/format'
import { Section } from '../Section'

type View = 'complete' | 'incomplete'

const CAUSES = [
  ['The probe failed', 'It was never sent, or the local network was down.'],
  ['The reply came too late', 'It arrived after the timeout, so nothing was written.'],
  ['The collector failed', 'The logger or the database dropped the result.'],
] as const

export function MissingDataSection() {
  const { bundle } = useDataset()
  const synthetic = bundle.source.type === 'synthetic'
  const chart = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>('complete')
  const [lostOnce, setLostOnce] = useState(false)

  // first visit: the series is drawn left to right, then the masked measurements are lost
  const build = useConstruction(`build-${bundle.observed.label}`, 2.4)
  const lose = useConstruction('lose', 1.1)
  const showIncomplete = () => {
    setView('incomplete')
    setLostOnce(true)
    lose.play()
  }
  useFirstView(chart, () => {
    build.play()
    window.setTimeout(showIncomplete, 2900)
  })

  const missing = useMemo(() => new Set(bundle.missingIndices), [bundle])
  const truth = bundle.groundTruth.values

  const complete: PlotMeasurement[] = bundle.observed.measurements.map((m) => {
    const v = truth.get(m.index) ?? null
    return v === null ? { index: m.index, x: m.timestamp, y: null, status: 'missing' } : { index: m.index, x: m.timestamp, y: v, status: 'observed' }
  })
  const incomplete: PlotMeasurement[] = bundle.observed.measurements.map((m) => ({ index: m.index, x: m.timestamp, y: m.observedPingMs, status: m.status }))

  // while switching to the incomplete view, the lost points fade out before the gaps appear
  const fading = view === 'incomplete' && lose.s < 1
  const data = view === 'complete' || fading ? complete : incomplete

  const facts = useMemo(() => {
    const ms = bundle.observed.measurements
    const observed = ms.flatMap((m) => (m.observedPingMs === null ? [] : [m.observedPingMs]))
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    let broken = 0
    for (let i = 1; i < ms.length; i++) if (ms[i].status === 'missing' || ms[i - 1].status === 'missing') broken++
    let longest = 0
    let run = 0
    for (const m of ms) {
      run = m.status === 'missing' ? 0 : run + 1
      longest = Math.max(longest, run)
    }
    return {
      total: ms.length,
      observed: observed.length,
      broken,
      steps: ms.length - 1,
      longest,
      observedMean: mean(observed),
      fullMean: synthetic ? mean([...truth.values()]) : null,
    }
  }, [bundle, synthetic, truth])

  return (
    <Section
      id="missing-data"
      tone="surface"
      title="When measurements disappear"
      intro="A missing record is a time slot with no value. The timestamp is there; the round-trip time is not. Toggle between the complete series and what the monitor actually stored."
      aside={
        <div className="segmented" role="group" aria-label="Series shown">
          <button type="button" aria-pressed={view === 'complete'} onClick={() => setView('complete')}>
            Complete
          </button>
          <button
            type="button"
            aria-pressed={view === 'incomplete'}
            onClick={showIncomplete}
          >
            Incomplete
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 [&>*]:min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div ref={chart} className="card p-4 sm:p-5" data-reveal>
          <div className="mb-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-actual" /> recorded
            </span>
            {view === 'complete' && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-missing" /> will be lost
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-missing" /> missing record
            </span>
          </div>
          <LatencyPlot
            data={data}
            height={330}
            drawn={build.s}
            highlight={missing}
            highlightFade={view === 'incomplete' ? lose.s : 0}
            label={view === 'complete' ? 'Complete latency series, with the measurements that will be lost in red' : 'Incomplete latency series with missing records'}
          />
          {!synthetic && view === 'complete' && (
            <p className="mt-2 text-xs text-muted">Imported data: rows that were empty in the file never had a value, so they stay missing in both views.</p>
          )}
          {lostOnce && view === 'incomplete' && (
            <p className="mt-2 text-sm text-muted" data-testid="lost-summary">
              {bundle.missingIndices.length} of {facts.total} measurements are missing.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3" data-reveal data-testid="why-gaps">
          <Fact value={`${fmt((facts.observed / facts.total) * 100, 0)} %`} text={`coverage: ${facts.observed} of ${facts.total} intervals hold a value; the longest unbroken run is ${facts.longest}.`} />
          <Fact value={`${facts.broken} of ${facts.steps}`} text="steps from one probe to the next have no rate of change, so trend calculations break across each gap." />
          {facts.fullMean !== null ? (
            <Fact value={`${fmt(facts.observedMean - facts.fullMean, 2)} ms`} text={`shift in the average: recorded values average ${fmt(facts.observedMean, 2)} ms, the full series ${fmt(facts.fullMean, 2)} ms.`} />
          ) : (
            <Fact value={`${fmt(facts.observedMean, 2)} ms`} text={`average of the ${facts.observed} recorded values; what the missing ones would add is unknown.`} />
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 [&>*]:min-w-0 gap-4 md:grid-cols-3" data-reveal>
        {CAUSES.map(([title, text]) => (
          <div key={title} className="border-l-2 border-missing pl-4">
            <p className="font-semibold">{title}</p>
            <p className="mt-0.5 text-sm text-muted">{text}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">A gap is not automatically packet loss: any of these leaves the same empty slot.</p>
    </Section>
  )
}

function Fact({ value, text }: { value: string; text: string }) {
  return (
    <div className="card p-4">
      <p className="num text-[1.6rem] leading-none text-missing-ink">{value}</p>
      <p className="mt-2 text-sm text-muted">{text}</p>
    </div>
  )
}
