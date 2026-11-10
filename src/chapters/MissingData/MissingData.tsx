import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import type { ChapterProps } from '../../types/presentation'
import { ChapterFrame, Reveal } from '../../components/presentation/ChapterFrame'
import { TIMELINE_EXAMPLE } from '../../data/datasets'
import { linearScale } from '../../components/graphs/scale'
import { useReducedMotion } from '../../hooks/useReducedMotion'

const W = 1712
const H = 380
const x = linearScale([1, 7], [150, W - 150])
const y = linearScale([20, 52], [H - 70, 40])
const BASE = H - 70

const CAUSES = [
  ['The probe failed', 'it was never sent, or the local network was down.'],
  ['The reply came too late', 'it arrived after the timeout, so nothing was written.'],
  ['The collector failed', 'the logger or database dropped the result.'],
] as const

const REASONS = [
  'Averages and percentiles are computed from fewer, biased samples.',
  'Charts break, and rate-of-change calculations fail across a gap.',
  'Many analysis tools expect one value per interval.',
] as const

export default function MissingData({ step }: ChapterProps) {
  const scope = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const known = TIMELINE_EXAMPLE.filter((p) => p.ping !== null)

  // Build 1: measurements arrive one by one, in time order.
  useGSAP(
    () => {
      if (step < 1 || reduced) return
      gsap.from('[data-measure]', { opacity: 0, y: 24, stagger: 0.22, duration: 0.4, ease: 'power2.out' })
      gsap.from('[data-trace]', { opacity: 0, duration: 0.6, delay: 0.22 * 7 })
    },
    { scope, dependencies: [step >= 1, reduced] },
  )

  // Build 2: the empty slots are marked.
  useGSAP(
    () => {
      if (step < 2 || reduced) return
      gsap.from('[data-gap]', { scale: 0.4, opacity: 0, transformOrigin: '50% 50%', duration: 0.5, stagger: 0.18, ease: 'back.out(2.2)' })
    },
    { scope, dependencies: [step >= 2, reduced] },
  )

  const segments: string[] = []
  let current = ''
  for (const p of TIMELINE_EXAMPLE) {
    if (p.ping === null) {
      if (current) segments.push(current)
      current = ''
    } else current += `${current ? 'L' : 'M'}${x(p.t)},${y(p.ping)}`
  }
  if (current) segments.push(current)

  return (
    <ChapterFrame
      number={3}
      title="When Measurements Disappear"
      lede="Seven seconds of pings, one probe per second. The timestamps are all there; two of the values are not."
    >
      <div ref={scope} className="flex h-full flex-col">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Timeline: 24, 28, 31 ms, missing, 42 ms, missing, 48 ms" className="shrink-0 overflow-visible">
          <line x1={90} x2={W - 90} y1={BASE} y2={BASE} stroke="#5f5751" strokeWidth={2} />
          {TIMELINE_EXAMPLE.map((p) => (
            <g key={p.t}>
              <line x1={x(p.t)} x2={x(p.t)} y1={BASE} y2={BASE + 12} stroke="#5f5751" strokeWidth={2} />
              <text x={x(p.t)} y={BASE + 46} textAnchor="middle" fontSize={24} fill="#5f5751">
                t = {p.t} s
              </text>
            </g>
          ))}

          {step >= 1 && (
            <g>
              <g data-trace>
                {segments.map((d) => (
                  <path key={d} d={d} fill="none" stroke="#633f32" strokeWidth={3} strokeOpacity={0.7} />
                ))}
              </g>
              {TIMELINE_EXAMPLE.map((p) =>
                p.ping === null ? null : (
                  <g key={p.t} data-measure>
                    <line x1={x(p.t)} x2={x(p.t)} y1={y(p.ping) + 12} y2={BASE} stroke="#633f32" strokeOpacity={0.18} strokeWidth={2} />
                    <circle cx={x(p.t)} cy={y(p.ping)} r={11} fill="#633f32" />
                    <text x={x(p.t)} y={y(p.ping) - 28} textAnchor="middle" fontSize={36} fill="#252525">
                      <tspan className="num">{p.ping}</tspan>
                      <tspan fontSize={24} fill="#5f5751" dx={6}>
                        ms
                      </tspan>
                    </text>
                  </g>
                ),
              )}
            </g>
          )}

          {step >= 2 &&
            TIMELINE_EXAMPLE.filter((p) => p.ping === null).map((p) => (
              <g key={p.t} data-gap data-testid={`timeline-gap-${p.t}`}>
                <rect x={x(p.t) - 78} y={36} width={156} height={BASE - 36} fill="#8e252d" fillOpacity={0.07} stroke="#8e252d" strokeOpacity={0.5} strokeWidth={2} strokeDasharray="8 8" rx={4} />
                <circle cx={x(p.t)} cy={BASE} r={13} fill="#faf8f4" stroke="#8e252d" strokeWidth={4} />
                <text x={x(p.t)} y={y(36)} textAnchor="middle" fontSize={25} fill="#8e252d" fontWeight={600}>
                  no record
                </text>
              </g>
            ))}
        </svg>

        <div className="mt-8 grid grid-cols-2 gap-x-[96px]">
          <Reveal visible={step >= 2}>
            <h2 className="section-heading">A gap is not always packet loss</h2>
            <p className="small-copy mt-2 text-muted">A missing record only tells us nothing was stored. Common causes:</p>
            <dl className="body-copy mt-3 space-y-2">
              {CAUSES.map(([cause, detail]) => (
                <div key={cause}>
                  <dt className="inline font-semibold text-crimson">{cause}: </dt>
                  <dd className="inline">{detail}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
          <Reveal visible={step >= 3}>
            <h2 className="section-heading">Why the gaps must be filled</h2>
            <ul className="body-copy mt-3 list-disc space-y-2 pl-7 marker:text-amber">
              {REASONS.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p className="small-copy mt-4 text-muted">
              {known.length} of {TIMELINE_EXAMPLE.length} values are known. Interpolation estimates the other {TIMELINE_EXAMPLE.length - known.length} from their neighbours, and marks them as estimates.
            </p>
          </Reveal>
        </div>
      </div>
    </ChapterFrame>
  )
}
