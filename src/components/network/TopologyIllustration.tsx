import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useReducedMotion } from '../../hooks/useReducedMotion'

type NodeId = 'device' | 'home' | 'isp' | 'ix' | 'core1' | 'core2' | 'cdn' | 'server' | 'n1' | 'n2' | 'n3' | 'n4' | 'n5' | 'n6' | 'n7' | 'n8'

const NODES: Record<NodeId, { x: number; y: number; label?: string; anchor?: 'start' | 'end' | 'middle'; dy?: number }> = {
  device: { x: 70, y: 470, label: 'Your device', anchor: 'start', dy: 44 },
  home: { x: 210, y: 360, label: 'Home router', anchor: 'start', dy: 44 },
  isp: { x: 360, y: 250, label: 'Provider', anchor: 'end', dy: -26 },
  ix: { x: 520, y: 300, label: 'Exchange point', anchor: 'middle', dy: 46 },
  core1: { x: 610, y: 150 },
  core2: { x: 470, y: 90 },
  cdn: { x: 330, y: 120 },
  server: { x: 720, y: 330, label: 'Server', anchor: 'end', dy: 50 },
  n1: { x: 120, y: 260 },
  n2: { x: 240, y: 170 },
  n3: { x: 650, y: 470 },
  n4: { x: 420, y: 430 },
  n5: { x: 560, y: 520 },
  n6: { x: 700, y: 60 },
  n7: { x: 250, y: 500 },
  n8: { x: 160, y: 80 },
}

const LINKS: [NodeId, NodeId][] = [
  ['device', 'home'], ['home', 'isp'], ['isp', 'ix'], ['ix', 'server'],
  ['home', 'n1'], ['n1', 'n2'], ['n2', 'isp'], ['n2', 'cdn'], ['cdn', 'core2'], ['core2', 'core1'],
  ['core1', 'server'], ['core1', 'n6'], ['core2', 'n6'], ['isp', 'cdn'], ['ix', 'core1'], ['ix', 'n4'],
  ['n4', 'home'], ['n4', 'n5'], ['n5', 'n3'], ['n3', 'server'], ['n7', 'n4'], ['n7', 'device'], ['n8', 'n2'], ['n8', 'n1'],
]

const ROUTE: NodeId[] = ['device', 'home', 'isp', 'ix', 'server']

/** Original line illustration of a small internet path; the route to the server is crimson. */
export function TopologyIllustration({ width = 780, height = 560 }: { width?: number; height?: number }) {
  const scope = useRef<SVGSVGElement>(null)
  const reduced = useReducedMotion()
  const route = ROUTE.map((id) => `${NODES[id].x},${NODES[id].y}`).join(' ')

  useGSAP(
    () => {
      if (reduced) return
      const path = scope.current?.querySelector<SVGPolylineElement>('[data-route]')
      const length = path && typeof path.getTotalLength === 'function' ? path.getTotalLength() : 0
      const tl = gsap.timeline({ delay: 0.3 })
      if (path && length) tl.fromTo(path, { strokeDasharray: length, strokeDashoffset: length }, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut' })
      tl.from('[data-route-node]', { scale: 0, transformOrigin: 'center', stagger: 0.25, duration: 0.35, ease: 'back.out(2)' }, 0.1)
    },
    { scope, dependencies: [reduced] },
  )

  return (
    <svg ref={scope} viewBox="0 0 780 560" width={width} height={height} role="img" aria-label="Illustration: a request path from your device through a home router, provider and exchange point to a server">
      {LINKS.map(([a, b]) => (
        <line key={`${a}-${b}`} x1={NODES[a].x} y1={NODES[a].y} x2={NODES[b].x} y2={NODES[b].y} stroke="#d6cbbb" strokeWidth={2} />
      ))}
      {(Object.keys(NODES) as NodeId[])
        .filter((id) => !ROUTE.includes(id))
        .map((id) => (
          <circle key={id} cx={NODES[id].x} cy={NODES[id].y} r={7} fill="#faf8f4" stroke="#b9ab98" strokeWidth={2} />
        ))}
      <polyline data-route points={route} fill="none" stroke="#8e252d" strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
      {ROUTE.map((id) => {
        const n = NODES[id]
        const end = id === 'device' || id === 'server'
        return (
          <g key={id}>
            <circle data-route-node cx={n.x} cy={n.y} r={end ? 15 : 11} fill={end ? '#8e252d' : '#faf8f4'} stroke="#8e252d" strokeWidth={4} />
            <text x={n.x + (n.anchor === 'start' ? -6 : n.anchor === 'end' ? 6 : 0)} y={n.y + (n.dy ?? 40)} textAnchor={n.anchor} fontSize={24} fill="#633f32" fontFamily="var(--font-sans)">
              {n.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
