import type { LiveRecord } from '../../simulation/networkSimulation/liveEngine'
import { linearScale } from '../graphs/scale'
import { useElementWidth } from '../../hooks/useViewport'

const DOMAIN = { lo: 20, hi: 75 }
const M = { top: 10, right: 10, bottom: 18, left: 34 }

/** Round-trip times of the latest probes on a dark panel; timeouts appear as crimson gaps. */
export function LiveTrace({ records, slots = 60, height = 200 }: { records: readonly LiveRecord[]; slots?: number; height?: number }) {
  const [box, width] = useElementWidth<HTMLDivElement>(700)
  const x = (i: number) => M.left + ((width - M.left - M.right) * i) / (slots - 1)
  const y = linearScale([DOMAIN.lo, DOMAIN.hi], [height - M.bottom, M.top])
  const clamp = (v: number) => Math.min(DOMAIN.hi, Math.max(DOMAIN.lo, v))
  const offset = slots - records.length

  const segments: string[] = []
  let pen = ''
  records.forEach((r, i) => {
    if (r.rtt === null) {
      if (pen) segments.push(pen)
      pen = ''
      return
    }
    pen += `${pen ? 'L' : 'M'}${x(i + offset).toFixed(1)},${y(clamp(r.rtt)).toFixed(1)}`
  })
  if (pen) segments.push(pen)

  return (
    <div ref={box} className="w-full">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block" role="img" aria-label="Live round-trip time of the latest probes" data-testid="live-trace">
        {[30, 50, 70].map((t) => (
          <g key={t}>
            <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke="#3a332e" />
            <text x={M.left - 6} y={y(t)} dy="0.35em" textAnchor="end" fontSize={11} fill="#8f8579" className="num">
              {t}
            </text>
          </g>
        ))}
        {segments.map((d) => (
          <path key={d} d={d} fill="none" stroke="#c9b8a6" strokeWidth={1.75} strokeLinejoin="round" />
        ))}
        {records.map((r, i) =>
          r.rtt === null ? (
            <g key={r.seq} data-testid="trace-gap">
              <line x1={x(i + offset)} x2={x(i + offset)} y1={M.top} y2={height - M.bottom} stroke="#e59a8f" strokeOpacity={0.45} strokeDasharray="3 4" />
              <circle cx={x(i + offset)} cy={height - M.bottom + 2} r={4.5} fill="#1e1a17" stroke="#e59a8f" strokeWidth={2} />
            </g>
          ) : (
            <circle key={r.seq} cx={x(i + offset)} cy={y(clamp(r.rtt))} r={i === records.length - 1 ? 4.5 : 2.4} fill={i === records.length - 1 ? '#c18b52' : '#c9b8a6'} />
          ),
        )}
      </svg>
    </div>
  )
}
