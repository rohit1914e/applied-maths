import { useRef, useState } from 'react'
import { LiveNetwork } from '../../components/network/LiveNetwork'
import { LiveTrace } from '../../components/network/LiveTrace'
import { useInView } from '../../hooks/useViewport'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { computeLiveStats, type LiveRecord } from '../../simulation/networkSimulation/liveEngine'
import { PROBE_TIMEOUT_MS, type ProbeResult } from '../../simulation/networkSimulation/simulateProbe'
import { fmt } from '../../utils/format'
import { Section, Stat } from '../Section'

const SPEEDS = [0.5, 1, 2, 4] as const
const HOPS = ['Client → router', 'Router → server', 'Server → router', 'Router → client']

export function SimulationSection() {
  const panel = useRef<HTMLDivElement>(null)
  const inView = useInView(panel)
  const reduced = useReducedMotion()
  const [paused, setPaused] = useState(reduced)
  const [speed, setSpeed] = useState(1)
  const [loss, setLoss] = useState(6)
  const [resetKey, setResetKey] = useState(0)
  const [records, setRecords] = useState<readonly LiveRecord[]>([])
  const [lastOk, setLastOk] = useState<ProbeResult | null>(null)
  const stats = computeLiveStats(records)
  const running = inView && !paused

  return (
    <Section
      id="simulation"
      title="Network simulation"
      intro="Each probe is an echo request that crosses the router to a server and comes back. The round-trip time is what a monitor records. When the reply does not return within the timeout, nothing is recorded at all."
    >
      <div className="grid grid-cols-1 [&>*]:min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div ref={panel} className="panel-dark p-4 sm:p-6" data-reveal>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">Client → router → server</p>
            <p className="text-xs text-panel-muted" role="status" data-testid="sim-status">
              {paused ? 'Paused' : inView ? `Running at ${speed}×` : 'Paused while off-screen'}
            </p>
          </div>
          <div className="mt-2">
            <LiveNetwork key={resetKey} running={running} speed={speed} lossProbability={loss / 100} onRecords={(r, ok) => (setRecords(r), setLastOk(ok))} />
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <p className="text-sm font-semibold text-white">Round-trip time, last {records.length} probes</p>
            <p className="num text-xs text-panel-muted" data-testid="probe-counter">
              probe #{stats.lastSequence}
            </p>
          </div>
          <div className="mt-2">
            <LiveTrace records={records} height={210} />
          </div>
          <p className="mt-2 text-xs text-panel-muted">Newest on the right. Red rings are probes that timed out after {PROBE_TIMEOUT_MS} ms and left no value.</p>
        </div>

        <div className="flex flex-col gap-4" data-reveal>
          <div className="card p-4">
            <p className="text-sm font-semibold">Controls</p>
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn btn-primary btn-sm flex-1" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
                {paused ? 'Resume' : 'Pause'}
              </button>
              <button type="button" className="btn btn-secondary btn-sm flex-1" onClick={() => setResetKey((k) => k + 1)}>
                Reset
              </button>
            </div>
            <p className="field-label mt-4">Speed</p>
            <div className="segmented mt-1.5" role="group" aria-label="Simulation speed">
              {SPEEDS.map((s) => (
                <button key={s} type="button" aria-pressed={speed === s} onClick={() => setSpeed(s)}>
                  {s}×
                </button>
              ))}
            </div>
            <label className="field-label mt-4 flex items-center justify-between" htmlFor="loss">
              Lost replies <span className="num text-ink">{loss} %</span>
            </label>
            <input id="loss" type="range" min={0} max={25} step={1} value={loss} onChange={(e) => setLoss(Number(e.target.value))} className="mt-2 w-full accent-accent" />
            {reduced && paused && <p className="mt-3 text-xs text-muted">Paused because your system prefers reduced motion. Resume to run it anyway.</p>}
          </div>

          <div className="grid grid-cols-1 [&>*]:min-w-0 grid-cols-2 gap-3" data-testid="sim-stats">
            <Stat label="Latest RTT" value={stats.latest?.rtt == null ? 'timeout' : fmt(stats.latest.rtt, 2)} unit={stats.latest?.rtt == null ? undefined : 'ms'} alert={stats.latest?.rtt == null} />
            <Stat label="Average" value={fmt(stats.mean, 2)} unit="ms" />
            <Stat label="Jitter" value={fmt(stats.jitter, 2)} unit="ms" />
            <Stat label="Timeouts" value={`${stats.timeouts}`} unit={`of ${stats.count} (${fmt(stats.timeoutRate * 100, 0)} %)`} alert={stats.timeouts > 0} testId="timeout-stat" />
          </div>

          {lastOk && (
            <div className="card p-4">
              <p className="text-sm font-semibold">Where the time goes, probe #{lastOk.sequence}</p>
              <table className="num mt-2 w-full text-sm">
                <tbody>
                  {lastOk.hops.map((h, i) => (
                    <tr key={i} className="border-b border-line last:border-0">
                      <td className="py-1 font-sans text-muted">{HOPS[i]}</td>
                      <td className="py-1 text-right">{fmt(h.delayMs)} ms</td>
                    </tr>
                  ))}
                  <tr className="border-b border-line">
                    <td className="py-1 font-sans text-muted">Server processing</td>
                    <td className="py-1 text-right">{fmt(lastOk.serverProcessingMs)} ms</td>
                  </tr>
                  <tr>
                    <td className="pt-1.5 font-sans font-semibold">Round trip</td>
                    <td className="pt-1.5 text-right font-semibold text-accent">{fmt(lastOk.rttMs!)} ms</td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-2 text-xs text-muted">Each hop adds propagation, transmission and queuing delay. Queuing changes with load, which is why the trace moves.</p>
            </div>
          )}
        </div>
      </div>
    </Section>
  )
}
