import { useMemo } from 'react'
import { SceneHeader } from '../../components/presentation/SceneHeader'
import { linearScale, niceTicks } from '../../components/graphs/scale'
import { useScene } from '../../experience/SceneContext'
import { useStoreValue } from '../../experience/store'
import { segment } from '../../experience/timeline'
import { useDataset } from '../../state/DatasetContext'
import { fmt, fmtSeconds } from '../../utils/format'

const W = 1712
const H = 470
const M = { top: 24, right: 20, bottom: 56, left: 76 }

// content-progress landmarks (kept in step with the scene's beats)
const BUILD_END = 0.32
const VANISH = [0.36, 0.52] as const
const WHY_AT = 0.6
const CAUSES_AT = 0.84

const CAUSES = [
  ['The probe failed', 'it was never sent, or the local network was down.'],
  ['The reply came too late', 'it arrived after the timeout, so nothing was written.'],
  ['The collector failed', 'the logger or the database dropped the result.'],
] as const

export default function MissingData() {
  const { progress } = useScene()
  const p = useStoreValue(progress)
  const { bundle } = useDataset()
  const synthetic = bundle.source.type === 'synthetic'

  const model = useMemo(() => {
    const ms = bundle.observed.measurements
    const truth = bundle.groundTruth.values
    // what the probes produced; genuinely missing CSV rows never had a value
    const points = ms.map((m) => ({ i: m.index, t: m.timestamp, v: truth.get(m.index) ?? null, missing: m.status === 'missing' }))
    const values = points.flatMap((pt) => (pt.v === null ? [] : [pt.v]))
    const lo = Math.min(...values)
    const hi = Math.max(...values)
    const pad = (hi - lo) * 0.12 + 1
    const yTicks = niceTicks(lo - pad, hi + pad, 5)
    const x = linearScale([ms[0].timestamp, ms[ms.length - 1].timestamp], [M.left, W - M.right])
    const y = linearScale([Math.min(lo - pad, yTicks[0]), Math.max(hi + pad, yTicks.at(-1)!)], [H - M.bottom, M.top])

    // why gaps hurt: every number below is computed from the series on screen
    const observedVals = ms.flatMap((m) => (m.observedPingMs === null ? [] : [m.observedPingMs]))
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    let brokenSteps = 0
    for (let i = 1; i < ms.length; i++) if (ms[i].status === 'missing' || ms[i - 1].status === 'missing') brokenSteps++
    let longest = 0
    let run = 0
    for (const m of ms) {
      run = m.status === 'missing' ? 0 : run + 1
      longest = Math.max(longest, run)
    }
    return {
      points,
      x,
      y,
      yTicks: yTicks.filter((t) => y(t) >= M.top - 1 && y(t) <= H - M.bottom + 1),
      xTicks: niceTicks(ms[0].timestamp, ms[ms.length - 1].timestamp, 10),
      observedMean: mean(observedVals),
      fullMean: synthetic ? mean(points.map((pt) => pt.v as number)) : null,
      brokenSteps,
      steps: ms.length - 1,
      longest,
      observed: observedVals.length,
      total: ms.length,
    }
  }, [bundle, synthetic])

  const reveal = segment(p, 0.02, BUILD_END) * model.points.length
  const vanish = segment(p, VANISH[0], VANISH[1])
  const baseline = H - M.bottom

  // one path through every revealed point, and one broken at the gaps
  let fullPath = ''
  let brokenPath = ''
  let pen = false
  model.points.forEach((pt, k) => {
    if (k >= reveal || pt.v === null) {
      pen = false
      return
    }
    const cmd = `${model.x(pt.t).toFixed(1)},${model.y(pt.v).toFixed(1)}`
    fullPath += `${fullPath ? 'L' : 'M'}${cmd}`
    if (pt.missing) {
      pen = false
      return
    }
    brokenPath += `${pen ? 'L' : 'M'}${cmd}`
    pen = true
  })

  const lede = p < VANISH[0] ? 'One probe per second, plotted as it arrives.' : p < WHY_AT ? 'Some of those measurements were never stored. The time slots remain; the values are gone.' : p < CAUSES_AT ? 'Gaps are not a cosmetic problem: they change the answers an analysis gives.' : 'A missing record is not automatically packet loss.'

  return (
    <div className="absolute inset-0 bg-ivory px-[104px] pt-[56px]">
      <SceneHeader number={2} title="When Measurements Disappear" lede={lede} />

      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="mt-6 block overflow-visible" role="img" aria-label="Latency series being built, then losing some measurements" data-testid="series-build">
        {model.yTicks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={model.y(t)} y2={model.y(t)} stroke="#e4dccf" strokeWidth={1.5} />
            <text x={M.left - 14} y={model.y(t)} dy="0.35em" textAnchor="end" fontSize={19} fill="#5f5751" className="num">
              {fmt(t, 0)}
            </text>
          </g>
        ))}
        <line x1={M.left} x2={W - M.right} y1={baseline} y2={baseline} stroke="#5f5751" strokeWidth={2} />
        {model.xTicks.map((t) => (
          <text key={t} x={model.x(t)} y={baseline + 30} textAnchor="middle" fontSize={19} fill="#5f5751" className="num">
            {fmtSeconds(t)}
          </text>
        ))}
        <text x={W - M.right} y={baseline + 54} textAnchor="end" fontSize={18} fill="#5f5751">
          time (s)
        </text>
        <text x={8} y={M.top - 6} fontSize={18} fill="#5f5751">
          RTT (ms)
        </text>

        <path d={fullPath} fill="none" stroke="#633f32" strokeWidth={2.5} strokeOpacity={0.75 * (1 - vanish)} strokeLinejoin="round" />
        <path d={brokenPath} fill="none" stroke="#633f32" strokeWidth={2.5} strokeOpacity={0.75 * vanish} strokeLinejoin="round" />

        {model.points.map((pt, k) => {
          if (k >= reveal) return null
          const cx = model.x(pt.t)
          const appear = Math.min(1, reveal - k)
          if (!pt.missing) return pt.v === null ? null : <circle key={pt.i} cx={cx} cy={model.y(pt.v)} r={5.5 * appear} fill="#633f32" />
          // a measurement that will disappear: it falls away and leaves a crimson slot
          const v = pt.v
          return (
            <g key={pt.i} data-testid={vanish >= 1 ? `vanished-${pt.i}` : undefined}>
              {v !== null && <circle cx={cx} cy={model.y(v) + 46 * vanish} r={5.5 * appear} fill="#633f32" opacity={1 - vanish} />}
              <line x1={cx} x2={cx} y1={M.top} y2={baseline} stroke="#8e252d" strokeOpacity={0.3 * vanish} strokeWidth={1.5} strokeDasharray="6 7" />
              <circle cx={cx} cy={baseline} r={9 * Math.max(vanish, v === null ? appear : 0)} fill="#faf8f4" stroke="#8e252d" strokeWidth={3} />
            </g>
          )
        })}
      </svg>

      <div className="mt-6 grid grid-cols-3 gap-x-[64px]" style={{ opacity: segment(p, WHY_AT - 0.04, WHY_AT), visibility: p >= WHY_AT - 0.04 ? 'visible' : 'hidden' }} data-testid="why-gaps">
        <Fact
          value={`${model.observed} of ${model.total}`}
          text={`intervals have a value. Coverage is ${fmt((model.observed / model.total) * 100, 0)} %, and the longest unbroken run is ${model.longest} records.`}
        />
        <Fact
          value={`${model.brokenSteps} of ${model.steps}`}
          text="steps from one probe to the next cannot be computed, so rate-of-change and trend calculations break across each gap."
        />
        {model.fullMean !== null ? (
          <Fact
            value={`${fmt(model.observedMean, 2)} ms`}
            text={`is the average of what was recorded. The full series averages ${fmt(model.fullMean, 2)} ms (known here only because the data are synthetic).`}
          />
        ) : (
          <Fact value={`${fmt(model.observedMean, 2)} ms`} text={`is the average of the ${model.observed} recorded values. What the missing ones would add is unknown.`} />
        )}
      </div>

      {p >= CAUSES_AT - 0.04 && (
        <div className="absolute inset-x-[104px] bottom-[52px] rounded-[4px] border-l-4 border-crimson bg-paper px-6 py-4" style={{ opacity: segment(p, CAUSES_AT - 0.04, CAUSES_AT) }} data-testid="causes">
          <p className="text-[22px] font-semibold">Why records go missing</p>
          <dl className="mt-1 grid grid-cols-3 gap-x-10 text-[20px] leading-snug">
            {CAUSES.map(([cause, detail]) => (
              <div key={cause}>
                <dt className="font-semibold text-crimson">{cause}</dt>
                <dd className="text-muted">{detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}

function Fact({ value, text }: { value: string; text: string }) {
  return (
    <div className="border-t-2 border-rule pt-3">
      <p className="num text-[40px] leading-tight text-crimson">{value}</p>
      <p className="small-copy mt-1 text-muted">{text}</p>
    </div>
  )
}
