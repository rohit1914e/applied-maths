import { useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import type { ChapterProps } from '../../types/presentation'
import { ChapterFrame, Reveal } from '../../components/presentation/ChapterFrame'
import { Laptop, Router, Server } from '../../components/network/NetworkDevices'
import { Tex } from '../../components/typography/Tex'
import { createProbeSimulator, PROBE_TIMEOUT_MS, type ProbeResult } from '../../simulation/networkSimulation/simulateProbe'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { fmt, fmtMs } from '../../utils/format'

const X = { client: 190, router: 856, server: 1522 }
const LANE = { out: 128, back: 214 }
const EDGE = { client: 290, routerIn: 760, routerOut: 952, server: 1430 }
const HOP_NAMES = ['Client → router', 'Router → server', 'Server → router', 'Router → client']

/** Visual leg duration: proportional to the simulated delay, clamped so it stays watchable. */
const legSeconds = (ms: number) => Math.min(1.25, Math.max(0.5, 0.35 + ms / 14))

export default function NetworkTransmission({ step }: ChapterProps) {
  const scope = useRef<HTMLDivElement>(null)
  const clockRef = useRef<HTMLSpanElement>(null)
  const [sendProbe] = useState(() => createProbeSimulator(2026))
  const reduced = useReducedMotion()
  const [running, setRunning] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'request' | 'server' | 'reply' | 'done' | 'timeout'>('idle')
  const [probes, setProbes] = useState<ProbeResult[]>([])
  const last = probes[0]

  const { contextSafe } = useGSAP({ scope })

  // contextSafe is applied when the presenter clicks, so the timeline joins this chapter's
  // GSAP context and is reverted when the chapter unmounts.
  const send = (forceTimeout: boolean) => contextSafe(() => {
    if (running) return
    const probe = sendProbe({ forceTimeout })
    const [h1, h2, h3, h4] = probe.hops
    const clock = { ms: 0 }
    const writeClock = () => {
      if (clockRef.current) clockRef.current.textContent = fmt(clock.ms, 2)
    }
    const finish = () => {
      setProbes((p) => [probe, ...p].slice(0, 6))
      setPhase(probe.timedOut ? 'timeout' : 'done')
      setRunning(false)
    }
    setRunning(true)
    setPhase('request')

    if (reduced) {
      clock.ms = probe.rttMs ?? PROBE_TIMEOUT_MS
      writeClock()
      finish()
      return
    }

    const tl = gsap.timeline({ onUpdate: writeClock, onComplete: finish })
    const req = '[data-packet="request"]'
    const rep = '[data-packet="reply"]'
    tl.set(req, { x: EDGE.client, opacity: 1 })
      .set(rep, { x: EDGE.server, opacity: 0 })
      .to(req, { x: EDGE.routerIn, duration: legSeconds(h1.delayMs), ease: 'none' })
      .to(clock, { ms: h1.delayMs, duration: legSeconds(h1.delayMs), ease: 'none' }, '<')
      .to('[data-router-led]', { fill: '#c18b52', duration: 0.1, yoyo: true, repeat: 1 })
      .set(req, { x: EDGE.routerOut })
      .to(req, { x: EDGE.server, duration: legSeconds(h2.delayMs), ease: 'none' })
      .to(clock, { ms: h1.delayMs + h2.delayMs, duration: legSeconds(h2.delayMs), ease: 'none' }, '<')
      .set(req, { opacity: 0 })
      .call(() => setPhase('server'))
      .to('[data-server]', { scale: 1.06, transformOrigin: '50% 50%', duration: 0.18, yoyo: true, repeat: 1 })
      .to(clock, { ms: h1.delayMs + h2.delayMs + probe.serverProcessingMs, duration: 0.36, ease: 'none' }, '<')
      .set(rep, { opacity: 1 })
      .call(() => setPhase('reply'))

    if (probe.timedOut) {
      tl.to(rep, { x: EDGE.routerOut, duration: legSeconds(h3.delayMs), ease: 'none' })
        .to(rep, { opacity: 0, scale: 0.4, transformOrigin: '50% 50%', duration: 0.35 })
        .to(clock, { ms: PROBE_TIMEOUT_MS, duration: 1.1, ease: 'power1.in' }, '<')
    } else {
      const toRouter = h1.delayMs + h2.delayMs + probe.serverProcessingMs + h3.delayMs
      tl.to(rep, { x: EDGE.routerOut, duration: legSeconds(h3.delayMs), ease: 'none' })
        .to(clock, { ms: toRouter, duration: legSeconds(h3.delayMs), ease: 'none' }, '<')
        .set(rep, { x: EDGE.routerIn })
        .to(rep, { x: EDGE.client, duration: legSeconds(h4.delayMs), ease: 'none' })
        .to(clock, { ms: probe.rttMs!, duration: legSeconds(h4.delayMs), ease: 'none' }, '<')
        .set(rep, { opacity: 0 })
    }
  })()

  const status =
    phase === 'idle'
      ? 'Ready to send an echo request.'
      : phase === 'request'
        ? 'Echo request travelling to the server.'
        : phase === 'server'
          ? 'Server received the request and is replying.'
          : phase === 'reply'
            ? 'Echo reply travelling back.'
            : phase === 'done'
              ? `Reply received after ${fmtMs(last?.rttMs ?? null)}.`
              : `No reply within ${PROBE_TIMEOUT_MS} ms. No round-trip time is recorded.`

  return (
    <ChapterFrame
      number={2}
      title="The Journey of a Network Packet"
      tone="dark"
      lede="A ping is a round trip: a request goes out, an echo comes back, and the sender times the difference."
    >
      <div ref={scope} className="flex h-full flex-col">
        {/* the journey */}
        <svg viewBox="0 0 1712 330" width={1712} height={300} role="img" aria-label="Client, router and server with the packet path between them" className="shrink-0">
          <defs>
            <marker id="arrow-out" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0 0 L10 5 L0 10 z" fill="#8f8579" />
            </marker>
          </defs>
          {[
            [EDGE.client, EDGE.routerIn],
            [EDGE.routerOut, EDGE.server],
          ].map(([a, b]) => (
            <g key={a} stroke="#5a5048" strokeWidth={2}>
              <line x1={a} x2={b} y1={LANE.out} y2={LANE.out} strokeDasharray="2 10" strokeLinecap="round" markerEnd="url(#arrow-out)" />
              <line x1={b} x2={a} y1={LANE.back} y2={LANE.back} strokeDasharray="2 10" strokeLinecap="round" markerEnd="url(#arrow-out)" />
            </g>
          ))}
          {[0, 1, 2, 3].map((i) => {
            const left = i === 0 || i === 3
            const out = i < 2
            const hop = last?.hops[i]
            const lost = last?.timedOut && i === 3
            const word = out ? 'request' : 'reply'
            const label = hop ? `${word}, ${lost ? 'lost' : `${hop.delayMs.toFixed(2)} ms`}` : word
            return (
              <text
                key={i}
                x={left ? (EDGE.client + EDGE.routerIn) / 2 : (EDGE.routerOut + EDGE.server) / 2}
                y={out ? LANE.out - 22 : LANE.back + 40}
                textAnchor="middle"
                fontSize={20}
                fill="#b5a999"
              >
                {label}
              </text>
            )
          })}

          <g transform={`translate(${X.client} 172)`}>
            <Laptop />
          </g>
          <g transform={`translate(${X.router} 172)`}>
            <Router />
          </g>
          <g transform={`translate(${X.server} 172)`} data-server>
            <Server />
          </g>
          {[
            ['Client', 'sends the probe', X.client],
            ['Router', 'forwards packets', X.router],
            ['Server', 'answers the echo', X.server],
          ].map(([name, role, x]) => (
            <g key={name as string}>
              <text x={x as number} y={300} textAnchor="middle" fontSize={26} fontWeight={600} fill="#faf8f4">
                {name}
              </text>
              <text x={x as number} y={328} textAnchor="middle" fontSize={19} fill="#b5a999">
                {role}
              </text>
            </g>
          ))}

          <g data-packet="request" opacity={0} transform={`translate(${EDGE.client} 0)`}>
            <circle cx={0} cy={LANE.out} r={13} fill="#c18b52" />
          </g>
          <g data-packet="reply" opacity={0} transform={`translate(${EDGE.server} 0)`}>
            <circle cx={0} cy={LANE.back} r={13} fill="#faf8f4" stroke="#c18b52" strokeWidth={4} />
          </g>
        </svg>

        <div className="mt-6 grid min-h-0 flex-1 grid-cols-[500px_620px_1fr] gap-x-[48px]">
          <div>
            <div className="flex flex-wrap gap-3">
              <button type="button" className="btn border-amber bg-amber text-night hover:!border-ivory hover:!bg-ivory" onClick={() => send(false)} disabled={running}>
                Send ping
              </button>
              <button type="button" className="btn btn-quiet border-night-ink text-night-ink" onClick={() => send(true)} disabled={running}>
                Send ping that times out
              </button>
            </div>
            <p className="small-copy mt-4 text-night-ink/80" role="status" aria-live="polite">
              {status}
            </p>
            <Reveal visible={step >= 1} className="mt-5">
              <h2 className="font-serif text-[26px] text-ivory">Where the time goes</h2>
              <dl className="small-copy mt-2 space-y-1.5 text-night-ink/85">
                <div><dt className="inline font-semibold text-ivory">Propagation: </dt><dd className="inline">distance divided by signal speed.</dd></div>
                <div><dt className="inline font-semibold text-ivory">Transmission: </dt><dd className="inline">packet size divided by link rate.</dd></div>
                <div><dt className="inline font-semibold text-ivory">Queuing: </dt><dd className="inline">waiting in a busy router buffer. It changes from probe to probe.</dd></div>
              </dl>
            </Reveal>
          </div>

          <div>
            <h2 className="font-serif text-[26px] text-ivory">Last probe, hop by hop</h2>
            {last ? (
              <table className="num mt-3 w-full text-[19px]" data-testid="hop-table">
                <thead className="text-left text-night-ink/65">
                  <tr>
                    <th className="py-1 font-sans font-semibold">Hop</th>
                    <th className="py-1 text-right font-sans font-semibold">Prop.</th>
                    <th className="py-1 text-right font-sans font-semibold">Trans.</th>
                    <th className="py-1 text-right font-sans font-semibold">Queue</th>
                    <th className="py-1 text-right font-sans font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {last.hops.map((h, i) => {
                    const lost = last.timedOut && i >= 2
                    return (
                      <tr key={i} className={`border-t border-night-rule ${lost ? 'text-night-ink/40' : ''}`}>
                        <td className="py-1.5 font-sans">{HOP_NAMES[i]}</td>
                        <td className="text-right">{lost && i === 3 ? '—' : fmt(h.propagationMs)}</td>
                        <td className="text-right">{lost && i === 3 ? '—' : fmt(h.transmissionMs)}</td>
                        <td className="text-right">{lost && i === 3 ? '—' : fmt(h.queuingMs)}</td>
                        <td className="text-right">{lost && i === 3 ? 'lost' : fmt(h.delayMs)}</td>
                      </tr>
                    )
                  })}
                  <tr className="border-t border-night-rule">
                    <td className="py-1.5 font-sans">Server processing</td>
                    <td colSpan={3} />
                    <td className="text-right">{fmt(last.serverProcessingMs)}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="small-copy mt-3 text-night-ink/70">Send a ping to see the delay added by each hop, in milliseconds.</p>
            )}
          </div>

          <div>
            <p className="text-[21px] text-night-ink/75">Round-trip time</p>
            <p className="num mt-1 text-[76px] leading-none text-ivory" data-testid="rtt-readout">
              <span ref={clockRef}>{last ? fmt(last.rttMs ?? PROBE_TIMEOUT_MS, 2) : '0.00'}</span>
              <span className="ml-3 text-[34px] text-night-ink/70">ms</span>
            </p>
            {phase === 'timeout' && <p className="mt-2 text-[21px] font-semibold text-[#e59a8f]">Timed out: no value recorded</p>}
            <ol className="num mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[19px] text-night-ink/75" aria-label="Probe history">
              {probes.map((p) => (
                <li key={p.sequence}>
                  #{p.sequence} {p.rttMs === null ? <span className="text-[#e59a8f]">no reply</span> : `${fmt(p.rttMs)} ms`}
                </li>
              ))}
            </ol>
            <Reveal visible={step >= 2} className="mt-4 text-[26px] text-ivory">
              <Tex tex="\mathrm{RTT} = t_{\text{reply received}} - t_{\text{request sent}}" display />
              <p className="small-copy -mt-1 text-night-ink/75">the sum of every hop there and back, plus server processing.</p>
            </Reveal>
          </div>
        </div>
      </div>
    </ChapterFrame>
  )
}
