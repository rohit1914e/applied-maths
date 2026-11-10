import { useEffect, useRef, useState } from 'react'
import { createLiveEngine, ENGINE_POOL, type LiveRecord } from '../../simulation/networkSimulation/liveEngine'
import type { ProbeResult } from '../../simulation/networkSimulation/simulateProbe'
import { Laptop, Router, Server } from './NetworkDevices'
import { COLORS } from '../../styles/tokens'

// geometry in viewBox units (1000 × 250)
const EDGE = { client: 190, routerIn: 425, routerOut: 575, server: 812 }
const LANE = { out: 78, back: 146 }
const X = { client: 112, router: 500, server: 890 }

/** Engine path position (0 client → 0.5 router → 1 server) → x coordinate. */
function xAt(pos: number): number {
  if (pos <= 0.45) return EDGE.client + (EDGE.routerIn - EDGE.client) * (pos / 0.45)
  if (pos <= 0.55) return EDGE.routerIn + (EDGE.routerOut - EDGE.routerIn) * ((pos - 0.45) / 0.1)
  return EDGE.routerOut + (EDGE.server - EDGE.routerOut) * ((pos - 0.55) / 0.45)
}

interface LiveNetworkProps {
  /** frames are produced only while true (visible, not paused, motion allowed) */
  readonly running: boolean
  readonly speed?: number
  readonly lossProbability?: number
  readonly seed?: number
  readonly onRecords: (records: readonly LiveRecord[], lastOk: ProbeResult | null) => void
  readonly label?: string
}

/**
 * Client → router → server with packets in flight. The simulation engine decides every
 * round-trip time; this component only draws it. Dots are moved by setting SVG attributes in
 * a requestAnimationFrame loop that exists only while `running`.
 */
export function LiveNetwork({ running, speed = 1, lossProbability = 0.06, seed = 2026, onRecords, label = 'Packets travelling between client, router and server' }: LiveNetworkProps) {
  const [engine] = useState(() => createLiveEngine({ seed, lossProbability }))
  const req = useRef<(SVGCircleElement | null)[]>([])
  const rep = useRef<(SVGCircleElement | null)[]>([])
  const glow = useRef<SVGCircleElement>(null)
  const report = useRef(onRecords)
  const speedRef = useRef(speed)
  useEffect(() => {
    report.current = onRecords
    speedRef.current = speed
  })

  useEffect(() => {
    report.current(engine.records(), engine.lastSuccessful())
  }, [engine])

  useEffect(() => engine.setLossProbability(lossProbability), [engine, lossProbability])

  const draw = () => {
    const shown = new Set<number>()
    let busy = false
    for (const f of engine.flights()) {
      shown.add(f.slot)
      const a = req.current[f.slot]
      const b = rep.current[f.slot]
      if (a) {
        a.setAttribute('opacity', f.request ? '1' : '0')
        if (f.request) a.setAttribute('cx', xAt(f.request.pos).toFixed(1))
      }
      if (b) {
        b.setAttribute('opacity', f.reply ? String(f.reply.opacity) : '0')
        if (f.reply) {
          b.setAttribute('cx', xAt(f.reply.pos).toFixed(1))
          b.setAttribute('stroke', f.reply.lost ? COLORS.panelAlert : COLORS.success)
        }
      }
      if (f.atServer) busy = true
    }
    for (let i = 0; i < ENGINE_POOL; i++) {
      if (!shown.has(i)) {
        req.current[i]?.setAttribute('opacity', '0')
        rep.current[i]?.setAttribute('opacity', '0')
      }
    }
    glow.current?.setAttribute('opacity', busy ? '0.8' : '0')
  }

  useEffect(() => {
    draw()
    if (!running) return
    let frame = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const done = engine.advance(dt * speedRef.current)
      draw()
      if (done.length) report.current(engine.records(), engine.lastSuccessful())
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
    // draw only touches refs and the engine
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, engine])

  return (
    <svg viewBox="0 0 1000 250" className="block h-auto w-full" role="img" aria-label={label} data-testid="live-network">
      {[
        [EDGE.client, EDGE.routerIn],
        [EDGE.routerOut, EDGE.server],
      ].map(([a, b]) => (
        <g key={a} stroke={COLORS.panelLine} strokeWidth={2} strokeDasharray="2 9" strokeLinecap="round">
          <line x1={a} x2={b} y1={LANE.out} y2={LANE.out} />
          <line x1={b} x2={a} y1={LANE.back} y2={LANE.back} />
        </g>
      ))}
      <text x={(EDGE.client + EDGE.routerIn) / 2} y={LANE.out - 16} textAnchor="middle" fontSize={17} fill={COLORS.panelMuted}>
        echo request
      </text>
      <text x={(EDGE.client + EDGE.routerIn) / 2} y={LANE.back + 30} textAnchor="middle" fontSize={17} fill={COLORS.panelMuted}>
        echo reply
      </text>
      <g transform={`translate(${X.client} 112) scale(0.72)`}>
        <Laptop />
      </g>
      <g transform={`translate(${X.router} 112) scale(0.72)`}>
        <Router />
      </g>
      <g transform={`translate(${X.server} 112) scale(0.72)`}>
        <Server />
      </g>
      <circle ref={glow} cx={X.server} cy={110} r={58} fill="none" stroke={COLORS.panelAccent} strokeWidth={2} opacity={0} />
      {[
        ['Client', X.client],
        ['Router', X.router],
        ['Server', X.server],
      ].map(([name, cx]) => (
        <text key={name as string} x={cx as number} y={226} textAnchor="middle" fontSize={20} fontWeight={600} fill={COLORS.panelInk}>
          {name}
        </text>
      ))}
      {Array.from({ length: ENGINE_POOL }, (_, i) => (
        <g key={i}>
          <circle ref={(el) => void (req.current[i] = el)} cx={EDGE.client} cy={LANE.out} r={8} fill={COLORS.panelAccent} opacity={0} data-packet="request" />
          <circle ref={(el) => void (rep.current[i] = el)} cx={EDGE.server} cy={LANE.back} r={7.5} fill={COLORS.panel} stroke={COLORS.success} strokeWidth={3} opacity={0} />
        </g>
      ))}
    </svg>
  )
}
