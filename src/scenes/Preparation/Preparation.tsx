import { useMemo, useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { SceneHeader } from '../../components/presentation/SceneHeader'
import { LatencyPlot } from '../../components/graphs/LatencyPlot'
import { toPlotData } from '../../components/graphs/plotData'
import { DatasetControls } from '../../components/data/DatasetControls'
import { useScene } from '../../experience/SceneContext'
import { useStoreListener, useStoreSelector } from '../../experience/store'
import { segment } from '../../experience/timeline'
import { useDataset } from '../../state/DatasetContext'
import { buildRawStream, runPreparationPipeline, type RawRecord } from '../../data/preparation/preparationPipeline'
import { fmt } from '../../utils/format'
import { PIPELINE_SPAN, STAGE_ENDS } from './timing'

const TL = 10 // timeline length in arbitrary units

const COL_X = [0, 445, 890, 1335]
const COLS = ['Arrival order', 'Validated', 'Sorted by time', 'Missing identified']
const GRID_TOP = 56
const GRID_H = 470
const MAX_CHIPS = 64

export default function Preparation() {
  const { progress } = useScene()
  const { bundle } = useDataset()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const scope = useRef<HTMLDivElement>(null)
  const timeline = useRef<gsap.core.Timeline | null>(null)

  const result = useMemo(() => runPreparationPipeline(buildRawStream(bundle.observed)), [bundle])

  // Large datasets are processed in full but drawn as a readable sample.
  const layout = useMemo(() => {
    const sortedShown = result.sorted.slice(0, MAX_CHIPS - result.rejected.length)
    const shownIds = new Set([...sortedShown.map((r) => r.record.id), ...result.rejected.map((r) => r.record.id)])
    const arrivals = result.arrivals.filter((r) => shownIds.has(r.id))
    const accepted = result.accepted.filter((r) => shownIds.has(r.record.id))
    const count = arrivals.length
    const rows = Math.ceil(count / 4)
    const rowH = Math.max(26, Math.min(40, GRID_H / rows))
    const slot = (col: number, k: number) => ({ x: COL_X[col] + (k % 4) * 96, y: GRID_TOP + Math.floor(k / 4) * rowH })
    return { arrivals, accepted, sortedShown, rowH, slot, rows, sampled: result.sorted.length > sortedShown.length }
  }, [result])

  const chipId = (r: RawRecord) => `chip-${r.id}`
  const missing = result.missingIds

  useGSAP(
    () => {
      const { arrivals, accepted, sortedShown, slot } = layout
      const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut' } })
      const el = (r: RawRecord) => `#${chipId(r)}`

      arrivals.forEach((r, k) => {
        const s = slot(0, k)
        tl.set(el(r), { x: -260, y: s.y, opacity: 0 }, 0)
        tl.to(el(r), { x: s.x, opacity: 1, duration: 0.5, ease: 'power2.out' }, (k / arrivals.length) * 1.5)
      })
      tl.to('[data-col="0"]', { opacity: 1, duration: 0.3 }, 0)

      // validation: accepted records move on, faulty ones drop into the tray
      const v0 = STAGE_ENDS[0] * TL
      tl.to('[data-col="1"]', { opacity: 1, duration: 0.3 }, v0)
      accepted.forEach((a, k) => {
        const s = slot(1, k)
        tl.to(el(a.record), { x: s.x, y: s.y, duration: 0.6 }, v0 + 0.2 + (k / accepted.length) * 1.4)
      })
      result.rejected.forEach((rj, k) => {
        tl.to(el(rj.record), { x: COL_X[1] + k * 96, y: GRID_TOP + GRID_H + 70, backgroundColor: '#f2e1df', borderColor: '#8e252d', color: '#8e252d', duration: 0.6 }, v0 + 0.3 + k * 0.3)
      })
      tl.to('[data-tray]', { opacity: 1, duration: 0.4 }, v0 + 0.4)

      // sorting by timestamp
      const s0 = STAGE_ENDS[1] * TL
      tl.to('[data-col="2"]', { opacity: 1, duration: 0.3 }, s0)
      sortedShown.forEach((a, k) => {
        const s = slot(2, k)
        tl.to(el(a.record), { x: s.x, y: s.y, duration: 0.7 }, s0 + 0.15 + (k / sortedShown.length) * 1.1)
      })

      // identifying records without a value
      const m0 = STAGE_ENDS[2] * TL
      tl.to('[data-col="3"]', { opacity: 1, duration: 0.3 }, m0)
      sortedShown.forEach((a, k) => {
        const s = slot(3, k)
        tl.to(el(a.record), { x: s.x, y: s.y, duration: 0.6 }, m0 + 0.1 + (k / sortedShown.length) * 0.8)
        if (missing.has(a.record.id)) {
          tl.to(el(a.record), { backgroundColor: '#f2e1df', borderColor: '#8e252d', color: '#8e252d', duration: 0.3 }, m0 + 1.1)
        }
      })

      // the clean dataset takes over
      const f0 = STAGE_ENDS[3] * TL
      tl.to('[data-chips]', { opacity: 0, duration: 0.8 }, f0 + 0.1)
      tl.to('[data-tray]', { opacity: 0, duration: 0.6 }, f0 + 0.1)
      tl.fromTo('[data-clean]', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.9 }, f0 + 0.4)
      tl.set({}, {}, TL)
      timeline.current = tl
      tl.progress(segment(progress.get(), ...PIPELINE_SPAN))
      return () => {
        timeline.current = null
      }
    },
    { scope, dependencies: [layout, result], revertOnUpdate: true },
  )

  useStoreListener(progress, (p) => timeline.current?.progress(segment(p, ...PIPELINE_SPAN)))

  const stage = useStoreSelector(progress, (p) => {
    const f = segment(p, ...PIPELINE_SPAN)
    const k = STAGE_ENDS.findIndex((end) => f <= end + 0.001)
    return k === -1 ? STAGE_ENDS.length - 1 : k
  })

  const reasons = result.rejected.map((r) => r.reason)
  const captions = [
    `${result.arrivals.length} raw records arrive in network order. Four faults were injected to show what validation catches.`,
    `${result.rejected.length} records rejected: ${reasons.join('; ')}. ${result.accepted.length} pass.`,
    `The ${result.accepted.length} valid records are ordered by timestamp.`,
    `${missing.size} records carry no value. They are kept as empty slots, never dropped or invented.`,
    `The clean dataset: ${result.sorted.length} records, ${result.sorted.length - missing.size} measured and ${missing.size} missing. This is the only input the interpolation code receives.`,
  ]

  const valueOf = (r: RawRecord) => (r.ping.trim() === '' ? 'empty' : r.ping)

  return (
    <div ref={scope} className="absolute inset-0 bg-ivory px-[104px] pt-[56px]">
      <SceneHeader number={3} title="Preparing the Measurements" lede={<span data-testid="pipeline-caption">{captions[stage]}</span>} />

      <button type="button" className="btn btn-quiet absolute top-[64px] right-[104px] !py-2 !text-[19px]" onClick={() => setSettingsOpen(true)}>
        Change dataset
      </button>

      <div className="relative mt-5 h-[640px]">
        {COLS.map((name, c) => (
          <div key={name} data-col={c} className="absolute top-0 w-[376px] border-b-2 border-rule pb-2" style={{ left: COL_X[c], opacity: 0.3 }}>
            <span className="num mr-3 text-[22px] text-crimson">{c + 1}</span>
            <span className="text-[22px] font-semibold">{name}</span>
          </div>
        ))}

        <div data-chips className="absolute inset-0">
          {layout.arrivals.map((r) => (
            <div
              key={r.id}
              id={chipId(r)}
              data-testid={r.injected ? `fault-${r.injected}` : undefined}
              className="num absolute top-0 left-0 flex w-[88px] items-center justify-center rounded-[3px] border-2 border-[#cdbfac] bg-white text-[17px] text-charcoal"
              style={{ height: layout.rowH - 6, opacity: 0 }}
            >
              {valueOf(r)}
            </div>
          ))}
        </div>

        <div data-tray className="absolute" style={{ left: COL_X[1], top: GRID_TOP + GRID_H + 30, opacity: 0 }}>
          <p className="text-[18px] font-semibold text-crimson">Rejected</p>
          <ul className="absolute top-[40px] left-[400px] w-[900px] space-y-0.5 text-[17px] text-muted">
            {result.rejected.map((r) => (
              <li key={r.record.id}>
                <span className="num mr-2 text-crimson">{valueOf(r.record)}</span>
                {r.reason}
              </li>
            ))}
          </ul>
        </div>

        <div data-clean className="absolute inset-x-0 top-[40px]" style={{ opacity: 0 }} data-testid="clean-dataset">
          <LatencyPlot width={1712} height={440} data={toPlotData(bundle.observed.measurements)} label="Clean dataset: measured values and empty slots" />
          <p className="mt-2 text-[19px] text-muted">
            {result.sorted.length} records from {fmt(result.sorted[0]?.timestamp ?? 0, 0)} to {fmt(result.sorted.at(-1)?.timestamp ?? 0, 1)} s
            {layout.sampled && `; the animation above showed ${layout.sortedShown.length} of them`}. Brown: measured. Crimson rings: missing.
          </p>
        </div>
      </div>

      {settingsOpen && (
        <div className="absolute inset-y-[40px] right-[40px] z-10 w-[720px] overflow-y-auto rounded-[6px] border-2 border-charcoal bg-paper p-8 shadow-[0_8px_40px_rgba(37,37,37,0.25)]" role="dialog" aria-label="Dataset settings">
          <div className="mb-5 flex items-baseline justify-between">
            <h3 className="section-heading">Dataset</h3>
            <button type="button" className="btn btn-quiet !py-2 !text-[19px]" onClick={() => setSettingsOpen(false)}>
              Close
            </button>
          </div>
          <DatasetControls />
          <p className="small-copy mt-6 text-muted">Every scene recomputes from the dataset you choose here.</p>
        </div>
      )}
    </div>
  )
}
