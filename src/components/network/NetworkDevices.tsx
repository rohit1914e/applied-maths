import { COLORS } from '../../styles/tokens'

/** Line drawings of the client, router and server, centred on (0, 0). */
const INK = COLORS.panelDevice

export function Laptop() {
  return (
    <g fill="none" stroke={INK} strokeWidth={3} strokeLinejoin="round">
      <rect x={-78} y={-66} width={156} height={100} rx={6} />
      <rect x={-66} y={-55} width={132} height={78} rx={2} strokeOpacity={0.45} />
      <path d="M-100 44 L100 44 L88 34 L-88 34 Z" />
      <path d="M-20 39 h40" strokeOpacity={0.6} />
    </g>
  )
}

export function Router({ flash = false }: { flash?: boolean }) {
  return (
    <g fill="none" stroke={INK} strokeWidth={3} strokeLinejoin="round">
      <path d="M-50 -18 L-62 -70 M50 -18 L62 -70" strokeLinecap="round" />
      <rect x={-86} y={-18} width={172} height={54} rx={8} />
      {[-52, -30, -8].map((x) => (
        <circle key={x} cx={x} cy={9} r={5} fill={flash ? COLORS.panelAccent : COLORS.panelLine} stroke="none" data-router-led />
      ))}
      <path d="M22 9 h42" strokeOpacity={0.5} />
    </g>
  )
}

export function Server({ flash = false }: { flash?: boolean }) {
  return (
    <g fill="none" stroke={INK} strokeWidth={3} strokeLinejoin="round">
      <rect x={-62} y={-92} width={124} height={176} rx={6} />
      {[-58, -14, 30].map((y) => (
        <g key={y}>
          <rect x={-48} y={y} width={96} height={32} rx={3} strokeOpacity={0.55} />
          <circle cx={32} cy={y + 16} r={4.5} fill={flash ? COLORS.panelAccent : COLORS.panelLine} stroke="none" />
          <path d={`M-36 ${y + 16} h40`} strokeOpacity={0.4} />
        </g>
      ))}
    </g>
  )
}
