import type { ReactNode } from 'react'

interface SectionProps {
  readonly id: string
  readonly title: string
  readonly intro?: ReactNode
  readonly tone?: 'ivory' | 'paper'
  readonly children: ReactNode
  /** content placed to the right of the heading (controls) */
  readonly aside?: ReactNode
}

/** A page section: anchored, centred to the content width, with a heading and short intro. */
export function Section({ id, title, intro, tone = 'ivory', children, aside }: SectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={`py-16 md:py-20 ${tone === 'paper' ? 'bg-paper' : 'bg-ivory'}`}>
      <div className="wrap">
        <div className="flex flex-wrap items-end justify-between gap-6" data-reveal>
          <div className="max-w-3xl">
            <h2 id={`${id}-title`} className="heading-serif text-[2rem] leading-[1.15] md:text-[2.5rem]">
              {title}
            </h2>
            {intro && <div className="mt-3 text-[1.0625rem] leading-relaxed text-muted">{intro}</div>}
          </div>
          {aside}
        </div>
        <div className="mt-8 md:mt-10">{children}</div>
      </div>
    </section>
  )
}

export function Stat({ label, value, unit, tone = 'light', alert = false, testId }: { label: string; value: string; unit?: string; tone?: 'light' | 'dark'; alert?: boolean; testId?: string }) {
  const dark = tone === 'dark'
  return (
    <div className={dark ? 'rounded-lg bg-night-2 px-3.5 py-3' : 'card px-4 py-3'} data-testid={testId}>
      <p className={`text-xs font-medium ${dark ? 'text-night-muted' : 'text-muted'}`}>{label}</p>
      <p className={`num mt-1 text-[1.4rem] leading-none ${alert ? (dark ? 'text-alert' : 'text-crimson') : dark ? 'text-white' : 'text-charcoal'}`}>
        {value}
        {unit && <span className={`ml-1 text-xs ${dark ? 'text-night-muted' : 'text-muted'}`}>{unit}</span>}
      </p>
    </div>
  )
}
