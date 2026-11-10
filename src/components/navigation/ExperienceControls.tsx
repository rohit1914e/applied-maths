import { useEffect, useRef, useState } from 'react'
import type { SceneDefinition } from '../../types/presentation'
import type { ShortcutHandlers } from '../../hooks/useKeyboardShortcuts'
import type { NumberStore } from '../../experience/store'
import { useStoreListener } from '../../experience/store'
import { totalLength, type SceneSpan } from '../../experience/timeline'
import { SPEEDS, useMotion } from '../../experience/motion'

interface ExperienceControlsProps {
  scenes: readonly SceneDefinition[]
  spans: readonly SceneSpan[]
  position: NumberStore
  here: { scene: number; beat: number }
  notesOpen: boolean
  isFullscreen: boolean
  handlers: ShortcutHandlers
  onSeek: (position: number) => void
}

const ICONS = {
  up: 'M18 15l-6-6-6 6',
  down: 'M6 9l6 6 6-6',
  replay: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5',
  pause: 'M8 5v14M16 5v14',
  play: 'M7 5l12 7-12 7z',
  notes: 'M5 4h14v16H5zM9 9h6M9 13h6M9 17h3',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  collapse: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5',
  restart: 'M6 5v14M19 6l-9 6 9 6z',
  motion: 'M3 12h4l3-8 4 16 3-8h4',
}

function Icon({ d }: { d: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

/**
 * Presenter controls. Windowed, the bar sits below the stage; in fullscreen it overlays the
 * bottom edge and hides until the pointer moves, keeping the projection clean.
 */
export function ExperienceControls({ scenes, spans, position, here, notesOpen, isFullscreen, handlers, onSeek }: ExperienceControlsProps) {
  const motion = useMotion()
  const [menuOpen, setMenuOpen] = useState(false)
  const [idle, setIdle] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const fill = useRef<HTMLDivElement>(null)
  const total = totalLength(spans)
  const scene = scenes[here.scene]
  const beat = scene.beats[here.beat]

  useStoreListener(position, (g) => {
    if (fill.current) fill.current.style.width = `${(Math.min(g, total) / total) * 100}%`
  })

  useEffect(() => {
    if (!isFullscreen) return
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
  }, [isFullscreen])

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [menuOpen])

  const hidden = isFullscreen && idle && !menuOpen
  const btn = 'inline-flex h-10 items-center gap-2 rounded px-3 text-[14px] font-semibold text-ivory hover:bg-white/12 disabled:opacity-35 disabled:hover:bg-transparent'
  const label = 'hidden 2xl:inline'

  return (
    <nav
      aria-label="Presentation controls"
      data-testid="control-bar"
      data-hidden={hidden}
      className={`presenter-only z-20 flex min-h-[60px] flex-wrap items-center gap-1 bg-charcoal px-3 py-2 text-ivory transition-opacity duration-300 ${
        isFullscreen ? 'absolute inset-x-0 bottom-0 bg-charcoal/92' : 'relative shrink-0'
      } ${hidden ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
    >
      <button type="button" className={btn} onClick={handlers.previousBeat} aria-label="Previous step" title="Previous step (Up, PageUp, Shift+Space)">
        <Icon d={ICONS.up} />
      </button>

      <div className="relative">
        <button
          type="button"
          className={`${btn} w-[min(330px,calc(100vw-150px))] justify-between`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
          title="Scene list (keys 1–7, Left and Right arrows)"
        >
          <span className="truncate">
            <span className="num mr-2 text-amber">
              {scene.number}/{scenes.length}
            </span>
            {scene.title}
          </span>
          <Icon d={ICONS.down} />
        </button>
        {menuOpen && (
          <ul role="menu" aria-label="Scenes" className="absolute bottom-12 left-0 w-[min(420px,calc(100vw-24px))] overflow-hidden rounded border border-white/15 bg-charcoal py-1 shadow-xl">
            {scenes.map((s, i) => (
              <li key={s.id} role="none">
                <button
                  type="button"
                  role="menuitem"
                  aria-current={i === here.scene ? 'step' : undefined}
                  className={`flex w-full items-baseline gap-3 px-4 py-2 text-left text-[14px] hover:bg-white/10 ${i === here.scene ? 'text-amber' : ''}`}
                  onClick={() => {
                    handlers.goto(i)
                    setMenuOpen(false)
                  }}
                >
                  <span className="num w-5 text-right">{s.number}</span>
                  {s.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button type="button" className={btn} onClick={handlers.nextBeat} aria-label="Next step" title="Next step (Space, Down, PageDown)" data-testid="next-step">
        <Icon d={ICONS.down} />
        <span className="hidden max-w-[200px] truncate xl:inline">{beat?.label}</span>
      </button>

      {/* the whole story as one rail; scenes are segments sized by their length */}
      <div
        className="relative mx-3 hidden h-6 min-w-[200px] flex-1 cursor-pointer items-center lg:flex"
        role="slider"
        aria-label="Story position"
        aria-valuemin={1}
        aria-valuemax={scenes.length}
        aria-valuenow={here.scene + 1}
        aria-valuetext={`${scene.title}, ${beat?.label ?? ''}`}
        tabIndex={-1}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          onSeek(((e.clientX - r.left) / r.width) * total)
        }}
      >
        <div className="flex h-[5px] w-full gap-[3px]">
          {spans.map((s, i) => (
            <span key={scenes[i].id} className="h-full rounded-full bg-white/20" style={{ flexGrow: s.length }} title={scenes[i].title} />
          ))}
        </div>
        <div ref={fill} className="pointer-events-none absolute top-1/2 left-0 h-[5px] -translate-y-1/2 rounded-full bg-amber" style={{ width: 0 }} />
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-1">
        <button type="button" className={btn} onClick={handlers.togglePause} aria-pressed={motion.paused} aria-label={motion.paused ? 'Resume' : 'Pause'} title="Pause or resume animation (P)">
          <Icon d={motion.paused ? ICONS.play : ICONS.pause} /> <span className={label}>{motion.paused ? 'Resume' : 'Pause'}</span>
        </button>
        <label className="inline-flex h-10 items-center gap-1 rounded px-2 text-[14px] font-semibold" title="Animation speed (+ and −)">
          <span className="sr-only">Animation speed</span>
          <select
            aria-label="Animation speed"
            className="num rounded bg-transparent px-1 py-1 text-ivory outline-none hover:bg-white/12 [&>option]:bg-charcoal"
            value={motion.speed}
            onChange={(e) => motion.setSpeed(Number(e.target.value))}
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={btn} onClick={handlers.toggleReducedMotion} aria-pressed={motion.reduced} aria-label="Reduced motion" title="Reduced motion (M)">
          <Icon d={ICONS.motion} /> <span className={label}>{motion.reduced ? 'Motion reduced' : 'Reduce motion'}</span>
        </button>
        <button type="button" className={btn} onClick={handlers.replay} aria-label="Replay scene" title="Replay this scene (R)">
          <Icon d={ICONS.replay} /> <span className={label}>Replay</span>
        </button>
        <button type="button" className={btn} onClick={handlers.restart} aria-label="Restart" title="Restart from the beginning (Home)">
          <Icon d={ICONS.restart} /> <span className={label}>Restart</span>
        </button>
        <button type="button" className={btn} onClick={handlers.toggleNotes} aria-pressed={notesOpen} aria-label="Presenter mode" title="Presenter notes (N)" disabled={isFullscreen}>
          <Icon d={ICONS.notes} /> <span className={label}>Presenter</span>
        </button>
        <button type="button" className={btn} onClick={handlers.toggleFullscreen} aria-pressed={isFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} title="Fullscreen (F, Esc to exit)">
          <Icon d={isFullscreen ? ICONS.collapse : ICONS.expand} /> <span className={label}>{isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}</span>
        </button>
      </div>
    </nav>
  )
}
