import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { SceneDefinition } from '../types/presentation'
import { Stage } from '../components/presentation/Stage'
import { PresenterNotesPanel } from '../components/presentation/PresenterNotesPanel'
import { PresenterWindow } from '../components/presentation/PresenterWindow'
import { ExperienceControls } from '../components/navigation/ExperienceControls'
import { useFullscreen } from '../hooks/useFullscreen'
import { useKeyboardShortcuts, type ShortcutHandlers } from '../hooks/useKeyboardShortcuts'
import { SPEEDS, useMotion } from './motion'
import { SceneContext, type SceneRuntime } from './SceneContext'
import { createStore } from './store'
import { allBeatStops, beatPosition, currentBeat, layoutScenes, locate, stepBeat, totalLength, visibleScenes } from './timeline'

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const sameList = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((v, i) => v === b[i])

/**
 * One continuous story. A tall scroller provides the timeline; a sticky 16:9 stage shows the
 * scene(s) for the current scroll position, cross-fading between neighbours. Scrolling with
 * the wheel, the keyboard and the on-screen controls all move the same position; nothing
 * moves it on a timer, so the presenter stays in control.
 */
export function ExperienceShell({ scenes }: { scenes: readonly SceneDefinition[] }) {
  const motion = useMotion()
  const spans = useMemo(() => layoutScenes(scenes.map((s) => s.length)), [scenes])
  const total = totalLength(spans)
  const stops = useMemo(() => allBeatStops(spans, scenes.map((s) => s.beats)), [spans, scenes])
  const lazyScenes = useMemo(() => scenes.map((s) => lazy(s.load) as ComponentType), [scenes])

  const [position] = useState(() => createStore(0))
  const [progress] = useState(() => scenes.map(() => createStore(0)))
  const [exits] = useState(() => scenes.map(() => createStore(0)))
  const [visible, setVisible] = useState<number[]>([0])
  const [here, setHere] = useState({ scene: 0, beat: 0 })
  const [keys, setKeys] = useState(() => scenes.map(() => 0))
  const [notesOpen, setNotesOpen] = useState(false)
  const [notesWindow, setNotesWindow] = useState(false)
  const [popup, setPopup] = useState<Window | null>(null)
  const [screenH, setScreenH] = useState(1080)

  const rootRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const wrappers = useRef<(HTMLDivElement | null)[]>([])
  const screenHRef = useRef(1080)
  const navFrame = useRef(0)
  const navTarget = useRef(0)
  const motionRef = useRef(motion)
  useEffect(() => {
    motionRef.current = motion
  })

  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(rootRef)

  // position → scene progress, cross-fade opacity, mounted scenes, current beat
  useEffect(() => {
    const apply = () => {
      const g = position.get()
      const loc = locate(spans, g)
      progress.forEach((store, i) => store.set(i < loc.index ? 1 : i > loc.index ? 0 : loc.local))
      exits.forEach((store, i) => store.set(i === loc.index - 1 ? loc.enter : i < loc.index ? 1 : 0))
      const shown = visibleScenes(spans, g)
      for (const { index, opacity } of shown) {
        const el = wrappers.current[index]
        if (el) {
          el.style.opacity = String(opacity)
          el.style.pointerEvents = opacity < 0.5 ? 'none' : 'auto'
        }
      }
      const ids = shown.map((s) => s.index)
      setVisible((prev) => (sameList(prev, ids) ? prev : ids))
      const b = currentBeat(stops, g)
      setHere((prev) => (prev.scene === b.scene && prev.beat === b.beat ? prev : { scene: b.scene, beat: b.beat }))
    }
    apply()
    return position.subscribe(apply)
  }, [position, progress, exits, spans, stops])

  // Native scrolling (wheel, touch, scrollbar) → position, through ScrollTrigger.
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    gsap.registerPlugin(ScrollTrigger)
    const trigger = ScrollTrigger.create({
      scroller,
      start: 0,
      end: 'max',
      onUpdate: (self) => {
        if (!navFrame.current) position.set(self.scroll() / screenHRef.current)
      },
    })
    const cancel = () => cancelNav()
    scroller.addEventListener('wheel', cancel, { passive: true })
    scroller.addEventListener('touchstart', cancel, { passive: true })
    return () => {
      trigger.kill()
      scroller.removeEventListener('wheel', cancel)
      scroller.removeEventListener('touchstart', cancel)
    }
    // cancelNav only touches refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position])

  // Keep the position when the window (or fullscreen) changes size.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const measure = () => {
      const h = scroller.clientHeight || 1080
      if (h === screenHRef.current) return
      screenHRef.current = h
      setScreenH(h)
      requestAnimationFrame(() => {
        scroller.scrollTop = position.get() * h
        ScrollTrigger.refresh()
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [position])

  const cancelNav = () => {
    if (navFrame.current) cancelAnimationFrame(navFrame.current)
    navFrame.current = 0
  }

  /** Moves to a position over `seconds` (scaled by speed, frozen while paused). */
  const navigateTo = useCallback(
    (target: number, seconds: number) => {
      cancelNav()
      const scroller = scrollerRef.current
      const to = Math.min(Math.max(target, 0), total)
      navTarget.current = to
      let from = position.get()
      const apply = (g: number) => {
        position.set(g)
        if (scroller) scroller.scrollTop = g * screenHRef.current
      }
      if (motionRef.current.reduced || seconds <= 0) {
        apply(to)
        return
      }
      // Long jumps skip the scenes in between instead of rushing through them.
      if (Math.abs(to - from) > 6) {
        from = to - Math.sign(to - from) * 0.8
        apply(from)
      }
      let elapsed = 0
      let last = performance.now()
      const tick = (now: number) => {
        const dt = Math.min(0.1, (now - last) / 1000)
        last = now
        const m = motionRef.current
        if (!m.paused) elapsed += dt * m.speed
        const t = Math.min(1, elapsed / seconds)
        apply(from + (to - from) * easeInOut(t))
        navFrame.current = t < 1 ? requestAnimationFrame(tick) : 0
      }
      navFrame.current = requestAnimationFrame(tick)
    },
    [position, total],
  )

  const sceneStart = useCallback((i: number) => beatPosition(spans, i, 0), [spans])

  const handlers = useMemo<ShortcutHandlers>(() => {
    const g = () => position.get()
    // while a step is still travelling, the next press continues from where it is heading
    const from = () => (navFrame.current ? navTarget.current : position.get())
    return {
      nextBeat: () => {
        const stop = stepBeat(stops, from(), 1)
        if (stop) navigateTo(stop.position, stop.seconds)
      },
      previousBeat: () => {
        const stop = stepBeat(stops, from(), -1)
        if (stop) navigateTo(stop.position, 0.7)
      },
      nextScene: () => {
        const { index } = locate(spans, from())
        if (index < scenes.length - 1) navigateTo(sceneStart(index + 1), 1.4)
      },
      previousScene: () => {
        const { index, local } = locate(spans, g())
        const target = local > 0.02 || index === 0 ? index : index - 1
        navigateTo(sceneStart(target), 1.0)
      },
      goto: (i) => navigateTo(sceneStart(i), 1.2),
      toggleFullscreen: () => void toggleFullscreen(),
      toggleNotes: () => setNotesOpen((o) => !o),
      togglePause: () => motionRef.current.setPaused(!motionRef.current.paused),
      toggleReducedMotion: () => motionRef.current.setReduced(!motionRef.current.reduced),
      faster: () => {
        const i = SPEEDS.indexOf(motionRef.current.speed as (typeof SPEEDS)[number])
        motionRef.current.setSpeed(SPEEDS[Math.min(SPEEDS.length - 1, i + 1)])
      },
      slower: () => {
        const i = SPEEDS.indexOf(motionRef.current.speed as (typeof SPEEDS)[number])
        motionRef.current.setSpeed(SPEEDS[Math.max(0, i - 1)])
      },
      replay: () => {
        const { index } = locate(spans, g())
        setKeys((k) => k.map((v, i) => (i === index ? v + 1 : v)))
        motionRef.current.setPaused(false)
        navigateTo(sceneStart(index), 0)
      },
      restart: () => {
        setKeys((k) => k.map((v) => v + 1))
        motionRef.current.setPaused(false)
        navigateTo(0, 0)
      },
    }
  }, [position, stops, spans, scenes.length, navigateTo, sceneStart, toggleFullscreen])
  useKeyboardShortcuts(handlers, scenes.length, popup)

  // Preload the next scene's code so arriving never shows an empty frame.
  useEffect(() => {
    scenes[here.scene + 1]?.load()
  }, [scenes, here.scene])

  useEffect(() => {
    document.title = `${scenes[here.scene].number}. ${scenes[here.scene].title} — Network Latency Predictor`
  }, [scenes, here.scene])

  const runtimes = useMemo(
    () =>
      scenes.map(
        (_, index): SceneRuntime => ({
          index,
          progress: progress[index],
          exit: exits[index],
          playing: !motion.paused && !motion.reduced,
          reduced: motion.reduced,
          speed: motion.speed,
          goTo: (at: number) => {
            const target = beatPosition(spans, index, at)
            navigateTo(target, Math.min(2.4, 0.5 + Math.abs(target - position.get()) * 0.6))
          },
        }),
      ),
    [scenes, progress, exits, motion.paused, motion.reduced, motion.speed, spans, navigateTo, position],
  )

  // After a mouse click, release focus from the control so Space keeps meaning "next step".
  const releaseMouseFocus = (event: React.PointerEvent) => {
    if (event.pointerType !== 'mouse') return
    const el = document.activeElement as HTMLElement | null
    if (el && (el.tagName === 'BUTTON' || el.getAttribute('role') === 'tab')) el.blur()
  }

  const initialOpacity = (i: number) => visibleScenes(spans, position.get()).find((s) => s.index === i)?.opacity ?? 0
  const current = scenes[here.scene]
  const notes = (inWindow: boolean) => (
    <PresenterNotesPanel
      scene={current}
      beat={here.beat}
      inWindow={inWindow}
      onPopOut={inWindow ? undefined : () => setNotesWindow(true)}
      onClose={inWindow ? undefined : () => setNotesOpen(false)}
    />
  )

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div ref={rootRef} data-testid="presentation-root" className={`relative flex min-w-0 flex-1 flex-col ${isFullscreen ? 'bg-black' : ''}`} onPointerUp={releaseMouseFocus}>
        <div ref={scrollerRef} data-testid="scroller" className="scroller relative min-h-0 flex-1 overflow-x-hidden overflow-y-scroll">
          <div style={{ height: (total + 1) * screenH }}>
            <div className="sticky top-0" style={{ height: screenH }}>
              <div className={`h-full ${isFullscreen ? '' : 'p-4'}`}>
                <Stage>
                  {visible.map((i) => {
                    const Scene = lazyScenes[i]
                    return (
                      <div
                        key={`${scenes[i].id}-${keys[i]}`}
                        ref={(el) => {
                          wrappers.current[i] = el
                        }}
                        data-testid={`scene-${i + 1}`}
                        aria-roledescription="scene"
                        aria-label={scenes[i].title}
                        aria-hidden={i !== here.scene}
                        className="absolute inset-0"
                        style={{ opacity: initialOpacity(i) }}
                      >
                        <SceneContext.Provider value={runtimes[i]}>
                          <Suspense fallback={null}>
                            <Scene />
                          </Suspense>
                        </SceneContext.Provider>
                      </div>
                    )
                  })}
                </Stage>
              </div>
            </div>
          </div>
        </div>

        {motion.paused && (
          <div className="presenter-only pointer-events-none absolute top-6 right-6 z-30 rounded bg-charcoal/85 px-3 py-1 text-[13px] font-semibold text-ivory" role="status">
            Animation paused
          </div>
        )}

        <ExperienceControls
          scenes={scenes}
          spans={spans}
          position={position}
          here={here}
          notesOpen={notesOpen}
          isFullscreen={isFullscreen}
          handlers={handlers}
          onSeek={(g) => navigateTo(g, 0.8)}
        />
      </div>

      {notesOpen && !isFullscreen && !notesWindow && (
        <aside className="w-[400px] shrink-0 max-md:absolute max-md:inset-0 max-md:z-30 max-md:w-full">{notes(false)}</aside>
      )}
      {notesWindow && (
        <PresenterWindow onClose={() => setNotesWindow(false)} onReady={setPopup}>
          {notes(true)}
        </PresenterWindow>
      )}
    </div>
  )
}
