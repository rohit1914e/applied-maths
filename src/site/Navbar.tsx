import { useEffect, useState } from 'react'
import { NAV_LINKS } from './navLinks'

/** The site mark: a ping trace with one reconstructed value. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#252525" />
      <polyline points="5,21 9,17 13,18.5" fill="none" stroke="#e9e2d6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="19,12 23,14 27,9" fill="none" stroke="#e9e2d6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="15.5" r="2.6" fill="#c18b52" />
    </svg>
  )
}

/** Sticky top navigation with the current section highlighted and a compact mobile menu. */
export function Navbar() {
  const [active, setActive] = useState<string>('overview')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id)
      },
      { rootMargin: '-40% 0px -55% 0px' },
    )
    for (const { id } of NAV_LINKS) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!open) return
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])

  return (
    <header className="sticky top-0 z-50 border-b border-rule bg-ivory/90 backdrop-blur-md">
      <nav className="wrap flex h-16 items-center justify-between gap-6" aria-label="Main">
        <a href="#overview" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <LogoMark />
          <span className="heading-serif text-[1.15rem] leading-none whitespace-nowrap">Network Latency Predictor</span>
        </a>

        <ul className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((l) => (
            <li key={l.id}>
              <a
                href={`#${l.id}`}
                aria-current={active === l.id ? 'true' : undefined}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${active === l.id ? 'bg-paper text-charcoal' : 'text-muted hover:text-charcoal'}`}
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="btn btn-secondary btn-sm lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((o) => !o)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
          Menu
        </button>
      </nav>

      {open && (
        <ul id="mobile-nav" className="wrap grid gap-1 border-t border-rule pt-2 pb-4 lg:hidden">
          {NAV_LINKS.map((l) => (
            <li key={l.id}>
              <a href={`#${l.id}`} onClick={() => setOpen(false)} className={`block rounded-md px-3 py-2.5 text-[0.95rem] font-medium ${active === l.id ? 'bg-paper' : ''}`}>
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </header>
  )
}
