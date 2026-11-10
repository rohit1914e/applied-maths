import { useMemo, useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import type { Point } from '../../types/interpolation'
import type { MeasurementStatus } from '../../types/measurement'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useElementWidth } from '../../hooks/useViewport'
import { fmt, fmtSeconds } from '../../utils/format'
import { linearScale, niceTicks } from './scale'
import { COLORS } from '../../styles/tokens'

export interface PlotMeasurement {
  readonly index: number
  readonly x: number
  /** observed value, or the estimate when status is "reconstructed" */
  readonly y: number | null
  readonly status: MeasurementStatus
}

interface LatencyPlotProps {
  readonly data: readonly PlotMeasurement[]
  readonly height?: number
  /** interpolant to draw; animates in whenever `curveKey` changes (unless `curveReveal` is set) */
  readonly curve?: readonly Point[]
  readonly curveKey?: string
  /** draw the curve to this fraction (0–1) instead of animating it */
  readonly curveReveal?: number
  /** nodes used by the current estimate (ringed) */
  readonly nodes?: readonly Point[]
  readonly selectedIndex?: number | null
  readonly onSelectMissing?: (index: number) => void
  /** observed points drawn in red (values that are about to disappear) */
  readonly highlight?: ReadonlySet<number>
  /** 0–1: highlighted points fade and drop away (a measurement being lost) */
  readonly highlightFade?: number
  /** join reconstructed values into the line (the completed series) */
  readonly connectReconstructed?: boolean
  /** x position of a scanning guide */
  readonly scanX?: number | null
  /** 0–1: how much of the series is drawn, left to right (for build-up animations) */
  readonly drawn?: number
  readonly yDomain?: readonly [number, number]
  readonly label: string
}

const M = { top: 14, right: 14, bottom: 34, left: 46 }

/**
 * The latency chart used across the site. Measured points are blue, missing records are
 * red rings on the time axis, reconstructed values are amber diamonds. It measures its
 * container, so text stays the same size at every screen width. Hover shows the value.
 */
export function LatencyPlot({
  data,
  height = 320,
  curve,
  curveKey,
  curveReveal,
  nodes,
  selectedIndex = null,
  onSelectMissing,
  highlight,
  highlightFade = 0,
  connectReconstructed = false,
  scanX = null,
  drawn = 1,
  yDomain,
  label,
}: LatencyPlotProps) {
  const [box, width] = useElementWidth<HTMLDivElement>(720)
  const svgRef = useRef<SVGSVGElement>(null)
  const reduced = useReducedMotion()
  const [hover, setHover] = useState<number | null>(null)

  const { x, y, xTicks, yTicks } = useMemo(() => {
    const xs = data.map((d) => d.x)
    const values = [...data.flatMap((d) => (d.y === null ? [] : [d.y])), ...(curve ?? []).map((p) => p.y)]
    const [lo, hi] = yDomain ?? [Math.min(...values), Math.max(...values)]
    const pad = Math.max(1, (hi - lo) * 0.1)
    const yt = niceTicks(lo - pad, hi + pad, height > 260 ? 5 : 4)
    const yLo = Math.min(lo - pad, yt[0])
    const yHi = Math.max(hi + pad, yt.at(-1)!)
    const xLo = Math.min(...xs)
    const xHi = Math.max(...xs)
    return {
      x: linearScale([xLo, xHi], [M.left, width - M.right]),
      y: linearScale([yLo, yHi], [height - M.bottom, M.top]),
      xTicks: niceTicks(xLo, xHi, Math.max(3, Math.min(10, Math.round(width / 90)))).filter((t) => t >= xLo && t <= xHi),
      yTicks: yt.filter((t) => t >= yLo && t <= yHi),
    }
  }, [data, curve, yDomain, width, height])

  const visible = useMemo(() => {
    if (drawn >= 1 || data.length === 0) return data
    const cutoff = data[0].x + (data[data.length - 1].x - data[0].x) * drawn + 1e-9
    return data.filter((d) => d.x <= cutoff)
  }, [data, drawn])

  const linePath = useMemo(() => {
    let d = ''
    let pen = false
    for (const m of visible) {
      const joins = m.status === 'observed' || (connectReconstructed && m.status === 'reconstructed')
      if (joins && m.y !== null) {
        d += `${pen ? 'L' : 'M'}${x(m.x).toFixed(1)},${y(m.y).toFixed(1)}`
        pen = true
      } else pen = false
    }
    return d
  }, [visible, x, y, connectReconstructed])

  const curvePath = useMemo(() => (curve && curve.length > 1 ? curve.map((p, i) => `${i ? 'L' : 'M'}${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`).join('') : ''), [curve, x, y])

  useGSAP(
    () => {
      const path = svgRef.current?.querySelector<SVGPathElement>('[data-curve="animated"]')
      if (!path || reduced || typeof path.getTotalLength !== 'function') return
      const length = path.getTotalLength()
      gsap.fromTo(path, { strokeDasharray: length, strokeDashoffset: length }, { strokeDashoffset: 0, duration: 1, ease: 'power2.inOut' })
    },
    { scope: svgRef, dependencies: [curveKey, reduced] },
  )

  const baseline = height - M.bottom
  const r = data.length > 120 ? 2.4 : data.length > 50 ? 3.2 : 4
  const nodeSet = new Set((nodes ?? []).map((n) => n.x))
  const hovered = hover === null ? null : (data.find((d) => d.index === hover) ?? null)

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    let best: PlotMeasurement | null = null
    for (const d of visible) if (!best || Math.abs(x(d.x) - px) < Math.abs(x(best.x) - px)) best = d
    setHover(best && Math.abs(x(best.x) - px) < 24 ? best.index : null)
  }

  return (
    <div ref={box} className="relative w-full">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label}
        className="block overflow-visible"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke={COLORS.grid} />
            <text x={M.left - 8} y={y(t)} dy="0.35em" textAnchor="end" fontSize={11.5} fill={COLORS.muted} className="num">
              {fmt(t, Number.isInteger(t) ? 0 : 1)}
            </text>
          </g>
        ))}
        <line x1={M.left} x2={width - M.right} y1={baseline} y2={baseline} stroke={COLORS.axis} />
        {xTicks.map((t) => (
          <text key={`x${t}`} x={x(t)} y={baseline + 18} textAnchor="middle" fontSize={11.5} fill={COLORS.muted} className="num">
            {fmtSeconds(t)}
          </text>
        ))}
        <text x={width - M.right} y={baseline + 32} textAnchor="end" fontSize={11} fill={COLORS.axis}>
          time (s)
        </text>
        <text x={M.left - 8} y={M.top - 4} textAnchor="end" fontSize={11} fill={COLORS.axis}>
          ms
        </text>

        {scanX !== null && <line x1={x(scanX)} x2={x(scanX)} y1={M.top} y2={baseline} stroke={COLORS.estimate} strokeWidth={1.5} />}

        {visible
          .filter((m) => m.status !== 'observed')
          .map((m) => {
            const selected = m.index === selectedIndex
            return (
              <g
                key={`gap${m.index}`}
                data-testid={`gap-${m.index}`}
                onClick={onSelectMissing ? () => onSelectMissing(m.index) : undefined}
                style={{ cursor: onSelectMissing ? 'pointer' : 'default' }}
              >
                <line x1={x(m.x)} x2={x(m.x)} y1={M.top} y2={baseline} stroke={COLORS.missing} strokeOpacity={selected ? 0.8 : 0.22} strokeDasharray="4 5" />
                <circle cx={x(m.x)} cy={baseline} r={selected ? 6.5 : 5} fill={COLORS.surface} stroke={COLORS.missing} strokeWidth={2} />
                {onSelectMissing && <rect x={x(m.x) - 10} y={M.top} width={20} height={baseline - M.top + 10} fill="transparent" />}
              </g>
            )
          })}

        <path d={linePath} fill="none" stroke={COLORS.actual} strokeOpacity={0.55} strokeWidth={1.75} strokeLinejoin="round" />
        {visible
          .filter((m) => m.status === 'observed' && m.y !== null)
          .map((m) => {
            const isNode = nodeSet.has(m.x)
            const hot = highlight?.has(m.index)
            return (
              <circle
                key={`p${m.index}`}
                data-testid={hot ? `highlight-${m.index}` : undefined}
                cx={x(m.x)}
                cy={y(m.y!) + (hot ? 28 * highlightFade : 0)}
                opacity={hot ? 1 - highlightFade : 1}
                r={isNode ? r + 2.5 : hot ? r + 1 : r}
                fill={isNode ? COLORS.surface : hot ? COLORS.missing : COLORS.actual}
                stroke={isNode ? COLORS.actual : 'none'}
                strokeWidth={isNode ? 2.5 : 0}
              />
            )
          })}

        {curvePath &&
          (curveReveal === undefined ? (
            <path data-curve="animated" d={curvePath} fill="none" stroke={COLORS.estimate} strokeWidth={2.75} strokeLinecap="round" />
          ) : (
            <path d={curvePath} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - curveReveal} fill="none" stroke={COLORS.estimate} strokeWidth={2.75} strokeLinecap="round" />
          ))}

        {visible
          .filter((m) => m.status === 'reconstructed' && m.y !== null)
          .map((m) => (
            <rect
              key={`r${m.index}`}
              data-testid={`reconstructed-${m.index}`}
              x={x(m.x) - r - 1.5}
              y={y(m.y!) - r - 1.5}
              width={(r + 1.5) * 2}
              height={(r + 1.5) * 2}
              transform={`rotate(45 ${x(m.x)} ${y(m.y!)})`}
              fill={COLORS.estimate}
              stroke={COLORS.estimateInk}
              strokeWidth={1.25}
            />
          ))}

        {hovered && <line x1={x(hovered.x)} x2={x(hovered.x)} y1={M.top} y2={baseline} stroke={COLORS.ink} strokeOpacity={0.25} />}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-line bg-white px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: Math.min(width - 150, Math.max(0, x(hovered.x) + 10)), top: 6 }}
        >
          <span className="num">t = {fmtSeconds(hovered.x)} s</span>
          <br />
          {hovered.status === 'missing' ? (
            <span className="font-semibold text-missing-ink">missing</span>
          ) : (
            <span className={`num font-semibold ${hovered.status === 'reconstructed' ? 'text-estimate-ink' : ''}`}>
              {fmt(hovered.y!, 2)} ms{hovered.status === 'reconstructed' ? ' (estimate)' : ''}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
