import { createRng } from '../random'

export interface HopTiming {
  readonly from: 'client' | 'router' | 'server'
  readonly to: 'client' | 'router' | 'server'
  /** one-way delay for this hop, ms */
  readonly delayMs: number
  /** components of the hop delay */
  readonly propagationMs: number
  readonly queuingMs: number
  readonly transmissionMs: number
}

export interface ProbeResult {
  readonly sequence: number
  readonly hops: readonly HopTiming[]
  readonly serverProcessingMs: number
  /** null when the reply did not arrive before the timeout */
  readonly rttMs: number | null
  readonly timedOut: boolean
  readonly timeoutMs: number
}

export interface ProbeOptions {
  readonly forceTimeout?: boolean
}

const LINKS = {
  'client-router': { propagationMs: 0.9, transmissionMs: 0.12, meanQueueMs: 0.8 },
  'router-server': { propagationMs: 11.5, transmissionMs: 0.05, meanQueueMs: 3.2 },
} as const

export const PROBE_TIMEOUT_MS = 1000

/**
 * A stateful probe generator. Each hop delay is propagation (distance / signal speed),
 * transmission (packet size / link rate) and queuing, drawn from an exponential
 * distribution because router queues fill in bursts. RTT is the sum of all hops plus
 * the server's processing time.
 */
export function createProbeSimulator(seed = 42) {
  const rng = createRng(seed)
  let sequence = 0
  const exponential = (mean: number) => -mean * Math.log(Math.max(1 - rng(), Number.EPSILON))
  const round = (v: number) => Math.round(v * 100) / 100

  const hop = (from: HopTiming['from'], to: HopTiming['to']): HopTiming => {
    const link = from === 'server' || to === 'server' ? LINKS['router-server'] : LINKS['client-router']
    const queuingMs = round(exponential(link.meanQueueMs))
    const propagationMs = link.propagationMs
    const transmissionMs = link.transmissionMs
    return { from, to, propagationMs, queuingMs, transmissionMs, delayMs: round(propagationMs + transmissionMs + queuingMs) }
  }

  return function sendProbe(options: ProbeOptions = {}): ProbeResult {
    sequence++
    const hops = [hop('client', 'router'), hop('router', 'server'), hop('server', 'router'), hop('router', 'client')]
    const serverProcessingMs = round(0.2 + rng() * 0.4)
    const total = round(hops.reduce((sum, h) => sum + h.delayMs, 0) + serverProcessingMs)
    const timedOut = options.forceTimeout === true || total > PROBE_TIMEOUT_MS
    return { sequence, hops, serverProcessingMs, rttMs: timedOut ? null : total, timedOut, timeoutMs: PROBE_TIMEOUT_MS }
  }
}
