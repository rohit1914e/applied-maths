import { useMemo, useRef, useState } from 'react'
import { Laptop, Router, Server } from '../../components/network/NetworkDevices'
import { Tex } from '../../components/typography/Tex'
import { linearScale } from '../../components/graphs/scale'
import { useScene } from '../../experience/SceneContext'
import { useTicker } from '../../experience/motion'
import { useStoreListener, useStoreSelector } from '../../experience/store'
import { createProbeSimulator, PROBE_TIMEOUT_MS, type ProbeResult } from '../../simulation/networkSimulation/simulateProbe'
import { fmt } from '../../utils/format'

// Diagram geometry (viewBox units)
const EDGE = { client: 290, routerIn: 760, routerOut: 952, server: 1430 }
const LANE = { out: 128, back: 214 }
const X = { client: 190, router: 856, server: 1522 }
const POOL = 8
const LAUNCH_EVERY = 1.0 // seconds between probes at 1× speed, like ping's default interval
const TRACE_SLOTS = 60
const PREFILL = 60
const TRACE = { w: 1712, h: 200, lo: 20, hi: 72 }

/** A network whose load rises and falls slowly, with occasional lost replies. */
const NETWORK = {
  lossProbability: 0.06,
  load: (n: number) => 1 + 0.9 * (0.5 + 0.5 * Math.sin(n / 13)) + 0.5 * Math.max(0, Math.sin(n / 5.3) - 0.7),
}

interface Record {
  readonly seq: number
  readonly rtt: number | null
}

interface Flight {
  readonly probe: ProbeResult
  readonly legs: readonly number[]
  t: number
  slot: number
}

const leg = (ms: number) => Math.min(1.25, Math.max(0.45, 0.35 + ms / 16))
const PAUSE = { router: 0.1, server: 0.2 }

/** Where a probe's request and reply dots are, `t` seconds after it was sent. */
function flightState(f: Flight) {
  const [l1, l2, l3, l4] = f.legs
  const bounds = [l1, PAUSE.router, l2, PAUSE.server, l3, PAUSE.router, l4]
  let t = f.t
  let seg = 0
  while (seg < bounds.length && t > bounds[seg]) {
    t -= bounds[seg]
    seg++
  }
  const u = seg < bounds.length ? t / bounds[seg] : 1
  const lerp = (a: number, b: number) => a + (b - a) * u
  const lost = f.probe.timedOut
  switch (seg) {
    case 0:
      return { req: { x: lerp(EDGE.client, EDGE.routerIn), o: 1 }, rep: null, done: false }
    case 1:
      return { req: { x: lerp(EDGE.routerIn, EDGE.routerOut), o: 1 }, rep: null, done: false }
    case 2:
      return { req: { x: lerp(EDGE.routerOut, EDGE.server), o: 1 }, rep: null, done: false }
    case 3:
      return { req: null, rep: null, server: true, done: false }
    case 4:
      return { req: null, rep: { x: lerp(EDGE.server, EDGE.routerOut), o: 1 }, done: false }
    case 5:
      return lost ? { req: null, rep: { x: EDGE.routerOut, o: 1 - u, lost: true }, done: false } : { req: null, rep: { x: lerp(EDGE.routerOut, EDGE.routerIn), o: 1 }, done: false }
    case 6:
      return lost ? { req: null, rep: null, done: u >= 1 } : { req: null, rep: { x: lerp(EDGE.routerIn, EDGE.client), o: 1 }, done: false }
    default:
      return { req: null, rep: null, done: true }
  }
}

export default function LiveNetwork() {
  const { progress, exit, playing, speed } = useScene()
  const beat = useStoreSelector(progress, (p) => (p < 0.3 ? 0 : p < 0.7 ? 1 : 2))

  const [sim] = useState(() => {
    const send = createProbeSimulator(2026, NETWORK)
    const first: Record[] = []
    let lastOk: ProbeResult | null = null
    for (let i = 0; i < PREFILL; i++) {
      const p = send()
      first.push({ seq: p.sequence, rtt: p.rttMs })
      if (!p.timedOut) lastOk = p
    }
    // three probes already on their way, so measurements land within the first second
    const inFlight: Flight[] = [2.7, 1.7, 0.7].map((t, slot) => {
      const probe = send()
      return { probe, legs: probe.hops.map((h) => leg(h.delayMs)), t, slot }
    })
    return { send, first, lastOk, inFlight }
  })
  const [records, setRecords] = useState<Record[]>(sim.first)
  const [lastOk, setLastOk] = useState<ProbeResult | null>(sim.lastOk)

  const flights = useRef<Flight[]>(sim.inFlight)
  const sinceLaunch = useRef(LAUNCH_EVERY * 0.3)
  const sinceRecord = useRef(1)
  const reqDots = useRef<(SVGCircleElement | null)[]>([])
  const repDots = useRef<(SVGCircleElement | null)[]>([])
  const serverRef = useRef<SVGGElement>(null)
  const traceGroup = useRef<SVGGElement>(null)
  const traceBox = useRef<HTMLDivElement>(null)
  const diagramBox = useRef<HTMLDivElement>(null)

  const slotW = TRACE.w / (TRACE_SLOTS - 1)

  useTicker(
    (dt) => {
      // launch a probe every second
      sinceLaunch.current += dt
      if (sinceLaunch.current >= LAUNCH_EVERY) {
        sinceLaunch.current -= LAUNCH_EVERY
        const used = new Set(flights.current.map((f) => f.slot))
        const slot = Array.from({ length: POOL }, (_, i) => i).find((i) => !used.has(i))
        if (slot !== undefined) {
          const probe = sim.send()
          flights.current.push({ probe, legs: probe.hops.map((h) => leg(h.delayMs)), t: 0, slot })
        }
      }
      // advance flights and draw them
      let serverBusy = false
      const shown = new Set<number>()
      const finished: Flight[] = []
      for (const f of flights.current) {
        f.t += dt
        const s = flightState(f)
        const req = reqDots.current[f.slot]
        const rep = repDots.current[f.slot]
        if (req) {
          req.setAttribute('opacity', s.req ? String(s.req.o) : '0')
          if (s.req) req.setAttribute('cx', s.req.x.toFixed(1))
        }
        if (rep) {
          rep.setAttribute('opacity', s.rep ? String(s.rep.o) : '0')
          if (s.rep) {
            rep.setAttribute('cx', s.rep.x.toFixed(1))
            rep.setAttribute('stroke', 'lost' in s.rep && s.rep.lost ? '#e59a8f' : '#c18b52')
          }
        }
        if (s.server) serverBusy = true
        shown.add(f.slot)
        if (s.done) finished.push(f)
      }
      if (serverRef.current) serverRef.current.style.opacity = serverBusy ? '1' : '0'
      if (finished.length) {
        flights.current = flights.current.filter((f) => !finished.includes(f))
        for (const f of finished) {
          reqDots.current[f.slot]?.setAttribute('opacity', '0')
          repDots.current[f.slot]?.setAttribute('opacity', '0')
        }
        setRecords((prev) => [...prev, ...finished.map((f) => ({ seq: f.probe.sequence, rtt: f.probe.rttMs }))].slice(-TRACE_SLOTS))
        const ok = finished.filter((f) => !f.probe.timedOut).at(-1)
        if (ok) setLastOk(ok.probe)
        sinceRecord.current = 0
      }
      // slide the trace one slot left as each new measurement lands
      sinceRecord.current += dt
      const offset = slotW * Math.max(0, 1 - sinceRecord.current / 0.45)
      traceGroup.current?.setAttribute('transform', `translate(${offset.toFixed(2)} 0)`)
    },
    playing,
    speed,
  )

  // as the next scene fades in, the trace rises and grows into its graph
  useStoreListener(exit, (e) => {
    if (traceBox.current) traceBox.current.style.transform = `translateY(${(-170 * e).toFixed(1)}px) scale(${(1 + 0.08 * e).toFixed(3)})`
    if (diagramBox.current) diagramBox.current.style.opacity = String(1 - Math.min(1, e * 1.6))
  })

  const stats = useMemo(() => {
    const ok = records.filter((r) => r.rtt !== null).map((r) => r.rtt as number)
    const mean = ok.reduce((a, b) => a + b, 0) / Math.max(1, ok.length)
    let jitterSum = 0
    let pairs = 0
    for (let i = 1; i < records.length; i++) {
      const a = records[i - 1].rtt
      const b = records[i].rtt
      if (a !== null && b !== null) {
        jitterSum += Math.abs(b - a)
        pairs++
      }
    }
    const latest = records.at(-1)
    return {
      latest,
      mean,
      jitter: pairs ? jitterSum / pairs : 0,
      timeouts: records.length - ok.length,
      total: records.at(-1)?.seq ?? 0,
    }
  }, [records])

  const y = linearScale([TRACE.lo, TRACE.hi], [TRACE.h - 14, 12])
  const x = (i: number) => i * slotW
  const offsetIndex = TRACE_SLOTS - records.length
  const segments: string[] = []
  let pen = ''
  records.forEach((r, i) => {
    if (r.rtt === null) {
      if (pen) segments.push(pen)
      pen = ''
      return
    }
    const v = Math.min(TRACE.hi, Math.max(TRACE.lo, r.rtt))
    pen += `${pen ? 'L' : 'M'}${x(i + offsetIndex).toFixed(1)},${y(v).toFixed(1)}`
  })
  if (pen) segments.push(pen)

  return (
    <div className="absolute inset-0 bg-night text-night-ink">
      {/* title */}
      <div className="absolute top-[64px] left-[104px] w-[1080px]">
        <p className="font-serif text-[24px] text-night-ink/70 italic">A numerical methods capstone</p>
        <h1 className="display-title mt-2 text-[100px] text-ivory">Network Latency Predictor</h1>
        <p className="mt-2 font-serif text-[34px] text-amber italic">Interpolating missing ping measurements</p>
      </div>

      {/* live readouts, computed from the simulated probes on screen */}
      <dl className="absolute top-[86px] right-[104px] grid w-[520px] grid-cols-2 gap-x-10 gap-y-5" aria-label="Live measurements" data-testid="live-readouts">
        <Readout label="Latest round trip" value={stats.latest?.rtt == null ? 'timeout' : `${fmt(stats.latest.rtt, 2)}`} unit={stats.latest?.rtt == null ? '' : 'ms'} alert={stats.latest?.rtt == null} />
        <Readout label={`Average, last ${records.length}`} value={fmt(stats.mean, 2)} unit="ms" />
        <Readout label="Jitter" value={fmt(stats.jitter, 2)} unit="ms" />
        <Readout label="Timeouts" value={`${stats.timeouts}`} unit={`of ${records.length}`} alert={stats.timeouts > 0} />
      </dl>

      {/* the network */}
      <div ref={diagramBox} className="absolute top-[320px] left-[104px]">
        <svg viewBox="0 0 1712 330" width={1712} height={300} role="img" aria-label="Packets travelling between client, router and server">
          {[
            [EDGE.client, EDGE.routerIn],
            [EDGE.routerOut, EDGE.server],
          ].map(([a, b]) => (
            <g key={a} stroke="#4a413a" strokeWidth={2} strokeDasharray="2 10" strokeLinecap="round">
              <line x1={a} x2={b} y1={LANE.out} y2={LANE.out} />
              <line x1={b} x2={a} y1={LANE.back} y2={LANE.back} />
            </g>
          ))}
          <text x={(EDGE.client + EDGE.routerIn) / 2} y={LANE.out - 22} textAnchor="middle" fontSize={20} fill="#b5a999">
            echo request
          </text>
          <text x={(EDGE.client + EDGE.routerIn) / 2} y={LANE.back + 40} textAnchor="middle" fontSize={20} fill="#b5a999">
            echo reply
          </text>
          <g transform={`translate(${X.client} 172)`}>
            <Laptop />
          </g>
          <g transform={`translate(${X.router} 172)`}>
            <Router />
          </g>
          <g transform={`translate(${X.server} 172)`}>
            <Server />
            <g ref={serverRef} style={{ opacity: 0 }}>
              <circle cx={0} cy={-4} r={72} fill="none" stroke="#c18b52" strokeWidth={2} strokeOpacity={0.6} />
            </g>
          </g>
          {[
            ['Client', 'sends a probe every second', X.client],
            ['Router', 'forwards packets', X.router],
            ['Server', 'answers the echo', X.server],
          ].map(([name, role, cx]) => (
            <g key={name as string}>
              <text x={cx as number} y={300} textAnchor="middle" fontSize={26} fontWeight={600} fill="#faf8f4">
                {name}
              </text>
              <text x={cx as number} y={328} textAnchor="middle" fontSize={19} fill="#b5a999">
                {role}
              </text>
            </g>
          ))}
          {Array.from({ length: POOL }, (_, i) => (
            <g key={i}>
              <circle ref={(el) => void (reqDots.current[i] = el)} cx={EDGE.client} cy={LANE.out} r={11} fill="#c18b52" opacity={0} />
              <circle ref={(el) => void (repDots.current[i] = el)} cx={EDGE.server} cy={LANE.back} r={10} fill="#1e1a17" stroke="#c18b52" strokeWidth={4} opacity={0} />
            </g>
          ))}
        </svg>
      </div>

      {/* narration for the current step */}
      <div className="absolute top-[640px] left-[104px] w-[1712px]" aria-live="polite">
        {beat === 0 && (
          <div className="flex items-end justify-between gap-12" data-testid="caption-0">
            <p className="lede max-w-[1150px] !text-[28px] text-night-ink/90">
              Each probe travels from the client through the router to a server, and an echo comes back. The time between sending and receiving is the round-trip time.
            </p>
            <p className="shrink-0 pb-1 font-serif text-[22px] text-amber italic">Scroll, or press Space, to explore</p>
          </div>
        )}
        {beat === 1 && lastOk && (
          <div className="flex items-start gap-12" data-testid="caption-1">
            <div className="w-[540px] shrink-0">
              <p className="section-heading text-ivory">Where the time goes</p>
              <div className="mt-1 text-[26px] text-ivory">
                <Tex tex="\mathrm{RTT} = t_{\text{reply}} - t_{\text{request}}" />
              </div>
            </div>
            <table className="num text-[20px] text-night-ink/90" aria-label={`Hop delays of probe ${lastOk.sequence}`}>
              <tbody>
                <tr className="text-night-ink/60">
                  {['Client→router', 'Router→server', 'Server', 'Server→router', 'Router→client'].map((h) => (
                    <td key={h} className="pr-8 font-sans text-[17px]">
                      {h}
                    </td>
                  ))}
                  <td className="font-sans text-[17px]">Round trip</td>
                </tr>
                <tr>
                  <td className="pr-8">{fmt(lastOk.hops[0].delayMs)}</td>
                  <td className="pr-8">{fmt(lastOk.hops[1].delayMs)}</td>
                  <td className="pr-8">{fmt(lastOk.serverProcessingMs)}</td>
                  <td className="pr-8">{fmt(lastOk.hops[2].delayMs)}</td>
                  <td className="pr-8">{fmt(lastOk.hops[3].delayMs)}</td>
                  <td className="text-[24px] text-amber">{fmt(lastOk.rttMs!)} ms</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {beat === 2 && (
          <div className="flex items-end justify-between gap-12" data-testid="caption-2">
            <div className="max-w-[1150px]">
              <p className="section-heading text-ivory">Some replies never arrive</p>
              <p className="lede mt-1 !text-[26px] text-night-ink/90">
                With no echo within {PROBE_TIMEOUT_MS} ms the monitor writes nothing. {stats.timeouts} of the last {records.length} probes left an empty slot, marked in crimson below.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* the live latency trace */}
      <div ref={traceBox} className="absolute top-[800px] left-[104px] origin-bottom" style={{ width: TRACE.w }}>
        <svg width={TRACE.w} height={TRACE.h} viewBox={`0 0 ${TRACE.w} ${TRACE.h}`} className="block overflow-visible" role="img" aria-label="Live round-trip time trace" data-testid="live-trace">
          {[30, 50, 70].map((t) => (
            <g key={t}>
              <line x1={0} x2={TRACE.w} y1={y(t)} y2={y(t)} stroke="#3a332e" strokeWidth={1.5} />
              <text x={-14} y={y(t)} dy="0.35em" textAnchor="end" fontSize={17} fill="#8f8579" className="num">
                {t}
              </text>
            </g>
          ))}
          <text x={-14} y={-6} textAnchor="end" fontSize={16} fill="#8f8579">
            ms
          </text>
          <g ref={traceGroup}>
            {segments.map((d) => (
              <path key={d} d={d} fill="none" stroke="#c9b8a6" strokeWidth={2.5} strokeLinejoin="round" />
            ))}
            {records.map((r, i) =>
              r.rtt === null ? (
                <g key={r.seq} data-testid="trace-gap">
                  <line x1={x(i + offsetIndex)} x2={x(i + offsetIndex)} y1={8} y2={TRACE.h - 6} stroke="#e59a8f" strokeOpacity={beat === 2 ? 0.7 : 0.35} strokeWidth={1.5} strokeDasharray="5 6" />
                  <circle cx={x(i + offsetIndex)} cy={TRACE.h - 6} r={beat === 2 ? 10 : 7} fill="#1e1a17" stroke="#e59a8f" strokeWidth={3} />
                </g>
              ) : (
                <circle key={r.seq} cx={x(i + offsetIndex)} cy={y(Math.min(TRACE.hi, Math.max(TRACE.lo, r.rtt)))} r={i === records.length - 1 ? 6 : 3.5} fill={i === records.length - 1 ? '#c18b52' : '#c9b8a6'} />
              ),
            )}
          </g>
        </svg>
        <p className="mt-2 flex justify-between text-[17px] text-night-ink/60">
          <span>Round-trip time of the last {records.length} probes, newest on the right</span>
          <span className="num">probe #{stats.total}</span>
        </p>
      </div>
    </div>
  )
}

function Readout({ label, value, unit, alert = false }: { label: string; value: string; unit: string; alert?: boolean }) {
  return (
    <div>
      <dt className="text-[18px] text-night-ink/65">{label}</dt>
      <dd className={`num mt-1 text-[40px] leading-none ${alert ? 'text-[#e59a8f]' : 'text-ivory'}`}>
        {value}
        {unit && <span className="ml-2 text-[20px] text-night-ink/60">{unit}</span>}
      </dd>
    </div>
  )
}
