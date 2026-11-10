import { useMemo } from 'react'
import { generateLatencySeries } from '../../simulation/datasetGenerator/generateDataset'
import { linearScale } from './scale'

/**
 * Decorative ping trace for the title composition: a seeded latency series drawn as one
 * line with a few records missing. Purely illustrative — no estimates are shown here.
 */
export function TraceMotif({ width, height, gaps = [11, 26, 27, 41] }: { width: number; height: number; gaps?: readonly number[] }) {
  const { segments, gapX, dots } = useMemo(() => {
    const series = generateLatencySeries({ sampleCount: 56, minLatencyMs: 20, maxLatencyMs: 70, seed: 31, irregularSampling: false })
    const x = linearScale([0, series.pingMs.length - 1], [8, width - 8])
    const y = linearScale([20, 70], [height - 10, 10])
    const hidden = new Set(gaps)
    const segs: string[] = []
    let current = ''
    series.pingMs.forEach((v, i) => {
      if (hidden.has(i)) {
        if (current) segs.push(current)
        current = ''
        return
      }
      current += `${current ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
    })
    if (current) segs.push(current)
    return {
      segments: segs,
      gapX: gaps.map((i) => x(i)),
      dots: series.pingMs.map((v, i) => ({ i, cx: x(i), cy: y(v) })).filter((d) => !hidden.has(d.i)),
    }
  }, [width, height, gaps])

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="block overflow-visible">
      {segments.map((d) => (
        <path key={d} d={d} fill="none" stroke="#633f32" strokeWidth={2.5} strokeLinejoin="round" />
      ))}
      {dots.map((d) => (
        <circle key={d.i} cx={d.cx} cy={d.cy} r={4} fill="#633f32" />
      ))}
      {gapX.map((gx) => (
        <g key={gx}>
          <line x1={gx} x2={gx} y1={0} y2={height} stroke="#8e252d" strokeOpacity={0.35} strokeWidth={1.5} strokeDasharray="5 6" />
          <circle cx={gx} cy={height} r={8} fill="#faf8f4" stroke="#8e252d" strokeWidth={3} />
        </g>
      ))}
    </svg>
  )
}
