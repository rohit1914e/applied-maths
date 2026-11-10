import type { ReactNode } from 'react'

/** Scene numeral, title and rule in the shared position at the top-left of the canvas. */
export function SceneHeader({ number, title, lede, tone = 'light' }: { number: number; title: string; lede?: ReactNode; tone?: 'light' | 'dark' }) {
  const dark = tone === 'dark'
  return (
    <header className="flex items-start gap-9">
      <div aria-hidden="true" className={`display-title pt-1 text-[80px] leading-none ${dark ? 'text-amber' : 'text-crimson'}`}>
        {String(number).padStart(2, '0')}
      </div>
      <div className="min-w-0 flex-1">
        <h2 className={`chapter-title !text-[62px] ${dark ? 'text-ivory' : 'text-charcoal'}`}>
          <span className="sr-only">Scene {number}: </span>
          {title}
        </h2>
        <div className={`mt-4 h-[2px] w-full ${dark ? 'bg-night-rule' : 'bg-rule'}`}>
          <div className={`h-full w-[160px] ${dark ? 'bg-amber' : 'bg-crimson'}`} />
        </div>
        {lede && <div className={`lede mt-4 max-w-[1560px] !text-[28px] ${dark ? 'text-night-ink/85' : 'text-muted'}`}>{lede}</div>}
      </div>
    </header>
  )
}
