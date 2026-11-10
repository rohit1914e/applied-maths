import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

export const STAGE_WIDTH = 1920
export const STAGE_HEIGHT = 1080

/**
 * A fixed 1920 × 1080 design canvas, scaled uniformly to fit its container and centred.
 * The composition is identical on a laptop screen and on a 1080p projector.
 */
export function Stage({ children, tone }: { children: ReactNode; tone: 'light' | 'dark' }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ scale: 1, left: 0, top: 0 })

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    const measure = () => {
      const { clientWidth: w, clientHeight: h } = host
      if (w === 0 || h === 0) return
      const scale = Math.min(w / STAGE_WIDTH, h / STAGE_HEIGHT)
      setBox({ scale, left: (w - STAGE_WIDTH * scale) / 2, top: (h - STAGE_HEIGHT * scale) / 2 })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={hostRef} className="relative h-full w-full overflow-hidden" data-testid="stage-host">
      <div
        data-testid="stage"
        data-tone={tone}
        className={`absolute origin-top-left overflow-hidden shadow-[0_2px_24px_rgba(60,40,30,0.18)] transition-colors duration-500 ${
          tone === 'dark' ? 'bg-night text-night-ink' : 'bg-ivory text-charcoal'
        }`}
        style={{
          width: STAGE_WIDTH,
          height: STAGE_HEIGHT,
          transform: `translate(${box.left}px, ${box.top}px) scale(${box.scale})`,
        }}
      >
        {children}
      </div>
    </div>
  )
}
