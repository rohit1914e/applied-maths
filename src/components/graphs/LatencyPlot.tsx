import { useMemo, useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import type { Point } from '../../types/interpolation'
import type { MeasurementStatus } from '../../types/measurement'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { fmt, fmtSeconds } from '../../utils/format'
import { linearScale, niceTicks } from './scale'

export interface PlotMeasurement {
  readonly index: number
  readonly x: number
  /** observed value, or the reconstructed value when status is "reconstructed" */
  readonly y: number | null
  readonly status: MeasurementStatus
}

interface LatencyPlotProps {
  readonly width: number
  readonly height: number
  readonly data: readonly PlotMeasurement[]
  /** interpolant to draw; it animates in whenever `curveKey` changes */
  readonly curve?: readonly Point[]
  readonly curveKey?: string
  /** nodes used by the current estimate */
  readonly nodes?: readonly Point[]
  readonly selectedIndex?: number | null
  readonly onSelectMissing?: (index: number) => void
  readonly yDomain?: readonly [number, number]
  readonly tone?: 'light' | 'dark'
  readonly label?: string
  /** show values above observed points (only for short series) */
  readonly showValues?: boolean
  /** draw the line through reconstructed values as well (the completed series) */
  readonly connectReconstructed?: boolean
}

const MARGIN = { top: 28, right: 28, bottom: 64, left: 84 }

/**
 * The latency chart used across chapters. Observed points are brown, missing records are
 * crimson slots on the time axis, reconstructed values are amber. Custom SVG keeps exact
 * control over the gap markers and lets GSAP draw the interpolant progressively.
 */
export function LatencyPlot({
  width,
  height,
  data,
  curve,
  curveKey,
  nodes,
  selectedIndex = null,
  onSelectMissing,
  yDomain,
  tone = 'light',
  label = 'Latency over time',
  showValues = false,
  connectReconstructed = false,
}: LatencyPlotProps) {
  const scope = useRef<SVGSVGElement>(null)
  const reduced = useReducedMotion()
  const dark = tone === 'dark'
  const ink = dark ? '#e9e2d6' : '#252525'
  const grid = dark ? '#3a332e' : '#e4dccf'
  const axis = dark ? '#8f8579' : '#5f5751'

  const { x, y, xTicks, yTicks } = useMemo(() => {
    const xs = data.map((d) => d.x)
    const values = [...data.flatMap((d) => (d.y === null ? [] : [d.y])), ...(curve ?? []).map((p) => p.y)]
    const [rawLo, rawHi] = yDomain ?? [Math.min(...values), Math.max(...values)]
    const pad = Math.max(2, (rawHi - rawLo) * 0.12)
    const yTicksLocal = niceTicks(rawLo - pad, rawHi + pad, 5)
    const yLo = Math.min(rawLo - pad, yTicksLocal[0])
    const yHi = Math.max(rawHi + pad, yTicksLocal.at(-1)!)
    const xLo = Math.min(...xs)
    const xHi = Math.max(...xs)
    return {
      x: linearScale([xLo, xHi], [MARGIN.left, width - MARGIN.right]),
      y: linearScale([yLo, yHi], [height - MARGIN.bottom, MARGIN.top]),
      xTicks: niceTicks(xLo, xHi, Math.min(10, Math.max(3, Math.round(width / 160)))).filter((t) => t >= xLo && t <= xHi),
      yTicks: yTicksLocal.filter((t) => t >= yLo && t <= yHi),
    }
  }, [data, curve, yDomain, width, height])

  // observed polyline, broken wherever a record is missing
  const observedPath = useMemo(() => {
    let d = ''
    let pen = false
    for (const m of data) {
      if ((m.status === 'observed' || (connectReconstructed && m.status === 'reconstructed')) && m.y !== null) {
        d += `${pen ? 'L' : 'M'}${x(m.x).toFixed(1)},${y(m.y).toFixed(1)}`
        pen = true
      } else pen = false
    }
    return d
  }, [data, x, y, connectReconstructed])

  const curvePath = useMemo(
    () => (curve && curve.length > 1 ? curve.map((p, i) => `${i ? 'L' : 'M'}${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`).join('') : ''),
    [curve, x, y],
  )

  useGSAP(
    () => {
      const path = scope.current?.querySelector<SVGPathElement>('[data-curve]')
      if (!path || reduced || typeof path.getTotalLength !== 'function') return
      const length = path.getTotalLength()
      gsap.fromTo(path, { strokeDasharray: length, strokeDashoffset: length }, { strokeDashoffset: 0, duration: 1.2, ease: 'power2.inOut' })
    },
    { scope, dependencies: [curveKey, reduced] },
  )

  const baseline = height - MARGIN.bottom
  const pointRadius = data.length > 90 ? 4 : data.length > 40 ? 5.5 : 8
  const nodeSet = new Set((nodes ?? []).map((n) => n.x))

  return (
    <svg ref={scope} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="block overflow-visible">
      {/* grid and axes */}
      {yTicks.map((t) => (
        <g key={`y${t}`}>
          <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(t)} y2={y(t)} stroke={grid} strokeWidth={1.5} />
          <text x={MARGIN.left - 14} y={y(t)} dy="0.35em" textAnchor="end" fontSize={19} fill={axis} className="num">
            {fmt(t, t % 1 === 0 ? 0 : 1)}
          </text>
        </g>
      ))}
      <line x1={MARGIN.left} x2={width - MARGIN.right} y1={baseline} y2={baseline} stroke={axis} strokeWidth={2} />
      {xTicks.map((t) => (
        <text key={`x${t}`} x={x(t)} y={baseline + 30} textAnchor="middle" fontSize={19} fill={axis} className="num">
          {fmtSeconds(t)}
        </text>
      ))}
      <text x={width - MARGIN.right} y={baseline + 58} textAnchor="end" fontSize={18} fill={axis}>
        time (s)
      </text>
      <text x={18} y={MARGIN.top - 4} fontSize={18} fill={axis}>
        RTT (ms)
      </text>

      {/* missing slots: vertical guide and a hollow marker on the time axis */}
      {data
        .filter((m) => m.status !== 'observed')
        .map((m) => {
          const selected = m.index === selectedIndex
          const interactive = onSelectMissing && m.status !== 'observed'
          return (
            <g
              key={`gap${m.index}`}
              data-testid={`gap-${m.index}`}
              data-status={m.status}
              onClick={interactive ? () => onSelectMissing(m.index) : undefined}
              style={{ cursor: interactive ? 'pointer' : 'default' }}
            >
              <line
                x1={x(m.x)}
                x2={x(m.x)}
                y1={MARGIN.top}
                y2={baseline}
                stroke="#8e252d"
                strokeOpacity={selected ? 0.9 : 0.28}
                strokeWidth={selected ? 2.5 : 1.5}
                strokeDasharray="6 7"
              />
              <circle cx={x(m.x)} cy={baseline} r={selected ? 11 : 8} fill={dark ? '#1e1a17' : '#faf8f4'} stroke="#8e252d" strokeWidth={3} />
              {interactive && <rect x={x(m.x) - 14} y={MARGIN.top} width={28} height={baseline - MARGIN.top + 14} fill="transparent" />}
            </g>
          )
        })}

      {/* observed series */}
      <path d={observedPath} fill="none" stroke={dark ? '#c9b8a6' : '#633f32'} strokeWidth={2.5} strokeLinejoin="round" strokeOpacity={0.75} />
      {data
        .filter((m) => m.status === 'observed' && m.y !== null)
        .map((m) => (
          <g key={`p${m.index}`}>
            <circle
              cx={x(m.x)}
              cy={y(m.y!)}
              r={nodeSet.has(m.x) ? pointRadius + 4 : pointRadius}
              fill={nodeSet.has(m.x) ? '#faf8f4' : dark ? '#e9e2d6' : '#633f32'}
              stroke={nodeSet.has(m.x) ? '#633f32' : 'none'}
              strokeWidth={nodeSet.has(m.x) ? 4 : 0}
            />
            {showValues && (
              <text x={x(m.x)} y={y(m.y!) - 22} textAnchor="middle" fontSize={22} fill={ink} className="num">
                {fmt(m.y!, 0)}
              </text>
            )}
          </g>
        ))}

      {/* interpolant */}
      {curvePath && <path data-curve d={curvePath} fill="none" stroke="#c18b52" strokeWidth={4} strokeLinecap="round" />}

      {/* reconstructed values */}
      {data
        .filter((m) => m.status === 'reconstructed' && m.y !== null)
        .map((m) => (
          <g key={`r${m.index}`} data-testid={`reconstructed-${m.index}`}>
            <rect
              x={x(m.x) - pointRadius - 2}
              y={y(m.y!) - pointRadius - 2}
              width={(pointRadius + 2) * 2}
              height={(pointRadius + 2) * 2}
              transform={`rotate(45 ${x(m.x)} ${y(m.y!)})`}
              fill="#c18b52"
              stroke={dark ? '#faf8f4' : '#633f32'}
              strokeWidth={2}
            />
            {showValues && (
              <text x={x(m.x)} y={y(m.y!) - 26} textAnchor="middle" fontSize={22} fill={dark ? '#e7c497' : '#7f5426'} className="num">
                {fmt(m.y!, 1)}
              </text>
            )}
          </g>
        ))}
    </svg>
  )
}
