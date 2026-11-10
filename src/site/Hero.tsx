import { useRef, useState } from 'react'
import { LiveNetwork } from '../components/network/LiveNetwork'
import { LiveTrace } from '../components/network/LiveTrace'
import { useInView } from '../hooks/useViewport'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { computeLiveStats, type LiveRecord } from '../simulation/networkSimulation/liveEngine'
import { useDataset } from '../state/DatasetContext'
import { METHOD_SHORT_LABELS } from '../types/interpolation'
import { fmt } from '../utils/format'
import { Stat } from './Section'

export function Hero() {
  const panel = useRef<HTMLDivElement>(null)
  const inView = useInView(panel)
  const reduced = useReducedMotion()
  const [records, setRecords] = useState<readonly LiveRecord[]>([])
  const stats = computeLiveStats(records)
  const { bundle, experiment } = useDataset()
  const best = experiment?.tiedBest.map((m) => METHOD_SHORT_LABELS[m]).join(' / ')
  const bestRmse = experiment?.results.find((r) => r.method === experiment.bestByRmse)?.metrics?.rmse

  return (
    <section id="overview" aria-labelledby="overview-title" className="border-b border-rule">
      <div className="wrap grid grid-cols-1 [&>*]:min-w-0 items-center gap-10 py-12 md:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-14">
        <div data-reveal>
          <p className="text-sm font-semibold text-crimson">Numerical Methods capstone</p>
          <h1 id="overview-title" className="heading-serif mt-3 text-[2.6rem] leading-[1.05] sm:text-[3.25rem] xl:text-[3.75rem]">
            Network Latency Predictor
          </h1>
          <p className="mt-4 font-serif text-[1.35rem] leading-snug text-brown italic md:text-[1.5rem]">Recovering missing network measurements through numerical interpolation</p>
          <p className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-muted">
            Ping monitors record round-trip times every second, but some records never arrive. This project rebuilds the missing values with Lagrange, Newton and natural cubic spline interpolation, shows every step of the arithmetic, and measures how accurate the estimates really are.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#simulation" className="btn btn-primary">
              Explore the simulation
            </a>
            <a href="#methods" className="btn btn-secondary">
              See the methods
            </a>
          </div>
          <dl className="mt-9 grid max-w-xl grid-cols-3 gap-4 border-t border-rule pt-5">
            <div>
              <dt className="text-xs text-muted">Measurements</dt>
              <dd className="num mt-1 text-xl">{bundle.observed.measurements.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Missing records</dt>
              <dd className="num mt-1 text-xl text-crimson">{bundle.missingIndices.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Lowest RMSE</dt>
              <dd className="num mt-1 text-xl">{bestRmse === undefined ? '—' : `${fmt(bestRmse, 2)} ms`}</dd>
              {best && <dd className="text-xs text-muted">{best}</dd>}
            </div>
          </dl>
        </div>

        <div ref={panel} className="panel-dark p-4 sm:p-6" data-reveal aria-label="Live network">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Live network</p>
            <p className="flex items-center gap-2 text-xs text-night-muted">
              <span className={`inline-block h-2 w-2 rounded-full ${inView && !reduced ? 'bg-amber' : 'bg-night-rule'}`} />
              {reduced ? 'Paused for reduced motion' : 'One probe per second'}
            </p>
          </div>
          <div className="mt-3">
            <LiveNetwork running={inView && !reduced} onRecords={(r) => setRecords(r)} seed={77} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4" data-testid="hero-metrics">
            <Stat tone="dark" label="Latest RTT" value={stats.latest?.rtt == null ? 'timeout' : fmt(stats.latest.rtt, 1)} unit={stats.latest?.rtt == null ? undefined : 'ms'} alert={stats.latest?.rtt == null} />
            <Stat tone="dark" label="Average" value={fmt(stats.mean, 1)} unit="ms" />
            <Stat tone="dark" label="Jitter" value={fmt(stats.jitter, 1)} unit="ms" />
            <Stat tone="dark" label="Timeouts" value={`${stats.timeouts}`} unit={`of ${stats.count}`} alert={stats.timeouts > 0} />
          </div>
          <div className="mt-3">
            <LiveTrace records={records} height={96} />
          </div>
        </div>
      </div>
    </section>
  )
}
