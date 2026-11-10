import { useEffect, useRef, useState } from 'react'
import type { ChapterDefinition } from '../../types/presentation'

interface ControlBarProps {
  chapters: readonly ChapterDefinition[]
  chapter: number
  step: number
  paused: boolean
  notesOpen: boolean
  isFullscreen: boolean
  overlay: boolean
  onPrevious: () => void
  onNext: () => void
  onAdvance: () => void
  onGoto: (index: number) => void
  onReplay: () => void
  onTogglePause: () => void
  onToggleNotes: () => void
  onToggleFullscreen: () => void
  onRestart: () => void
}

function Icon({ d, label }: { d: string; label?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden={label ? undefined : true}>
      <path d={d} />
    </svg>
  )
}

const ICONS = {
  prev: 'M15 18l-6-6 6-6',
  next: 'M9 18l6-6-6-6',
  replay: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5',
  pause: 'M8 5v14M16 5v14',
  play: 'M7 5l12 7-12 7z',
  notes: 'M5 4h14v16H5zM9 9h6M9 13h6M9 17h3',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  collapse: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5',
  restart: 'M6 5v14M19 6l-9 6 9 6z',
}

/**
 * Presenter controls. Windowed, the bar sits below the stage; in fullscreen it overlays the
 * stage bottom and hides itself until the pointer moves, keeping the projection clean.
 */
export function ControlBar(props: ControlBarProps) {
  const { chapters, chapter, step, paused, notesOpen, isFullscreen, overlay } = props
  const current = chapters[chapter]
  const [menuOpen, setMenuOpen] = useState(false)
  const [idle, setIdle] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!overlay) return
    const wake = () => {
      setIdle(false)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setIdle(true), 2200)
    }
    wake()
    window.addEventListener('pointermove', wake)
    return () => {
      window.removeEventListener('pointermove', wake)
      window.clearTimeout(timer.current)
    }
  }, [overlay])

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [menuOpen])

  const hidden = overlay && idle && !menuOpen
  const buttonClass =
    'inline-flex h-10 items-center gap-2 rounded px-3 text-[14px] font-semibold text-ivory hover:bg-white/12 disabled:opacity-35 disabled:hover:bg-transparent'

  return (
    <nav
      aria-label="Presentation controls"
      data-testid="control-bar"
      data-hidden={hidden}
      className={`presenter-only z-20 flex min-h-[60px] flex-wrap items-center gap-1 bg-charcoal px-3 py-2 text-ivory transition-opacity duration-300 ${
        overlay ? 'absolute inset-x-0 bottom-0 bg-charcoal/92' : 'relative shrink-0'
      } ${hidden ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
    >
      <button type="button" className={buttonClass} onClick={props.onPrevious} disabled={chapter === 0} aria-label="Previous chapter" title="Previous chapter (Left arrow)">
        <Icon d={ICONS.prev} />
      </button>

      <div className="relative">
        <button
          type="button"
          className={`${buttonClass} w-[min(340px,calc(100vw-140px))] justify-between`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
          title="Chapter list (keys 1–8)"
        >
          <span className="truncate">
            <span className="num mr-2 text-amber">{current.number}/8</span>
            {current.title}
          </span>
          <Icon d="M6 9l6 6 6-6" />
        </button>
        {menuOpen && (
          <ul role="menu" aria-label="Chapters" className="absolute bottom-12 left-0 w-[min(400px,calc(100vw-24px))] overflow-hidden rounded border border-white/15 bg-charcoal py-1 shadow-xl">
            {chapters.map((c, i) => (
              <li key={c.id} role="none">
                <button
                  type="button"
                  role="menuitem"
                  aria-current={i === chapter ? 'step' : undefined}
                  className={`flex w-full items-baseline gap-3 px-4 py-2 text-left text-[14px] hover:bg-white/10 ${i === chapter ? 'text-amber' : ''}`}
                  onClick={() => {
                    props.onGoto(i)
                    setMenuOpen(false)
                  }}
                >
                  <span className="num w-5 text-right">{c.number}</span>
                  {c.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button type="button" className={buttonClass} onClick={props.onNext} disabled={chapter === chapters.length - 1} aria-label="Next chapter" title="Next chapter (Right arrow)">
        <Icon d={ICONS.next} />
      </button>

      {/* chapter progress */}
      <div className="mx-3 hidden items-center gap-1.5 lg:flex" role="progressbar" aria-label="Chapter progress" aria-valuemin={1} aria-valuemax={chapters.length} aria-valuenow={chapter + 1}>
        {chapters.map((c, i) => (
          <span key={c.id} className={`h-[5px] w-7 rounded-full ${i < chapter ? 'bg-amber/70' : i === chapter ? 'bg-amber' : 'bg-white/20'}`} />
        ))}
      </div>

      {current.builds > 0 && (
        <button type="button" className={buttonClass} onClick={props.onAdvance} title="Next build (Space)" data-testid="next-build">
          <span className="num">
            {step}/{current.builds}
          </span>
          <span className="hidden xl:inline">{step < current.builds ? current.buildLabels[step] : 'Next chapter'}</span>
        </button>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-1">
        <button type="button" className={buttonClass} onClick={props.onReplay} aria-label="Replay" title="Replay demonstration (R)">
          <Icon d={ICONS.replay} /> <span className="hidden 2xl:inline">Replay</span>
        </button>
        <button type="button" className={buttonClass} onClick={props.onTogglePause} aria-pressed={paused} aria-label={paused ? 'Resume' : 'Pause'} title="Pause or resume animation (P)">
          <Icon d={paused ? ICONS.play : ICONS.pause} /> <span className="hidden 2xl:inline">{paused ? 'Resume' : 'Pause'}</span>
        </button>
        <button type="button" className={buttonClass} onClick={props.onToggleNotes} aria-pressed={notesOpen} aria-label="Notes" title="Presenter notes (N)" disabled={isFullscreen}>
          <Icon d={ICONS.notes} /> <span className="hidden 2xl:inline">Notes</span>
        </button>
        <button type="button" className={buttonClass} onClick={props.onToggleFullscreen} aria-pressed={isFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} title="Fullscreen (F, Esc to exit)">
          <Icon d={isFullscreen ? ICONS.collapse : ICONS.expand} /> <span className="hidden 2xl:inline">{isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}</span>
        </button>
        <button type="button" className={buttonClass} onClick={props.onRestart} aria-label="Restart" title="Restart presentation (Home)">
          <Icon d={ICONS.restart} /> <span className="hidden 2xl:inline">Restart</span>
        </button>
      </div>
    </nav>
  )
}
