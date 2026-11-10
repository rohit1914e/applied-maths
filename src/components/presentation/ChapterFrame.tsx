import { useRef, type ReactNode } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useReducedMotion } from '../../hooks/useReducedMotion'

interface ChapterFrameProps {
  readonly number: number
  readonly title: string
  readonly lede?: ReactNode
  readonly tone?: 'light' | 'dark'
  readonly children: ReactNode
}

/**
 * Shared chapter composition on the 1920 × 1080 canvas: numeral and title at the top-left,
 * one content region below, and a quiet running footer. The only entrance motion is the
 * rule under the title drawing across — one orchestrated moment per chapter.
 */
export function ChapterFrame({ number, title, lede, tone = 'light', children }: ChapterFrameProps) {
  const scope = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const dark = tone === 'dark'

  useGSAP(
    () => {
      if (reduced) return
      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } })
      tl.from('[data-anim="title"]', { opacity: 0, duration: 0.5 })
        .from('[data-anim="rule"]', { scaleX: 0, transformOrigin: 'left center', duration: 0.7, ease: 'power3.inOut' }, 0.1)
        .from('[data-anim="lede"]', { opacity: 0, duration: 0.5 }, 0.35)
    },
    { scope, dependencies: [reduced] },
  )

  return (
    <div ref={scope} className="absolute inset-0 flex flex-col px-[104px] pt-[64px] pb-[36px]">
      <header className="flex items-start gap-10">
        <div
          aria-hidden="true"
          className={`display-title pt-1 text-[88px] leading-none ${dark ? 'text-amber' : 'text-crimson'}`}
          style={{ fontVariantNumeric: 'oldstyle-nums' }}
        >
          {String(number).padStart(2, '0')}
        </div>
        <div className="min-w-0 flex-1">
          <h1 data-anim="title" className={`chapter-title ${dark ? 'text-ivory' : 'text-charcoal'}`}>
            <span className="sr-only">Chapter {number}: </span>
            {title}
          </h1>
          <div data-anim="rule" className={`mt-5 h-[2px] w-full ${dark ? 'bg-night-rule' : 'bg-rule'}`}>
            <div className={`h-full w-[160px] ${dark ? 'bg-amber' : 'bg-crimson'}`} />
          </div>
          {lede && (
            <p data-anim="lede" className={`lede mt-5 max-w-[1560px] ${dark ? 'text-night-ink/85' : 'text-muted'}`}>
              {lede}
            </p>
          )}
        </div>
      </header>

      <main className="relative mt-8 min-h-0 flex-1">{children}</main>

      <footer className={`mt-4 flex items-baseline justify-between text-[18px] ${dark ? 'text-night-ink/60' : 'text-muted'}`}>
        <span className="font-serif italic">Network Latency Predictor</span>
        <span className="num">{number} / 8</span>
      </footer>
    </div>
  )
}

/** Fades content in when `visible` first becomes true; reveals stay presenter-driven. */
export function Reveal({ visible, children, className, as = 'div' }: { visible: boolean; children: ReactNode; className?: string; as?: 'div' | 'section' | 'li' }) {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  useGSAP(
    () => {
      if (!visible || reduced || !ref.current) return
      gsap.fromTo(ref.current, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: 'power1.out' })
    },
    { dependencies: [visible, reduced] },
  )
  const Tag = as
  return (
    <Tag
      ref={ref as never}
      className={className}
      aria-hidden={!visible}
      style={{ visibility: visible ? 'visible' : 'hidden' }}
    >
      {children}
    </Tag>
  )
}
