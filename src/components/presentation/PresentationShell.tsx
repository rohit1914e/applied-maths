import { Suspense, lazy, useCallback, useEffect, useMemo, useReducer, useRef, useState, type ComponentType } from 'react'
import gsap from 'gsap'
import type { ChapterDefinition, ChapterProps } from '../../types/presentation'
import { useFullscreen } from '../../hooks/useFullscreen'
import { useKeyboardShortcuts, type ShortcutHandlers } from '../../hooks/useKeyboardShortcuts'
import { ControlBar } from '../navigation/ControlBar'
import { Stage } from './Stage'
import { PresenterNotesPanel } from './PresenterNotesPanel'
import { PresenterWindow } from './PresenterWindow'
import { createInitialState, presentationReducer, type PresentationAction, type PresentationState } from './presentationState'

/**
 * The presentation controller: owns chapter/build state, keyboard and fullscreen, and
 * mounts only the active chapter (so its GSAP context is reverted when it unmounts).
 */
export function PresentationShell({ chapters }: { chapters: readonly ChapterDefinition[] }) {
  const builds = useMemo(() => chapters.map((c) => c.builds), [chapters])
  const [state, dispatch] = useReducer(
    (s: PresentationState, a: PresentationAction) => presentationReducer(s, a, builds),
    undefined,
    createInitialState,
  )
  const rootRef = useRef<HTMLDivElement>(null)
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(rootRef)
  const [notesWindow, setNotesWindow] = useState(false)
  const [popup, setPopup] = useState<Window | null>(null)

  const lazyChapters = useMemo(() => chapters.map((c) => lazy(c.load) as ComponentType<ChapterProps>), [chapters])
  const current = chapters[state.chapter]
  const Chapter = lazyChapters[state.chapter]

  // Preload the neighbouring chapter so moving forward never shows a loading frame.
  useEffect(() => {
    chapters[state.chapter + 1]?.load()
  }, [chapters, state.chapter])

  // Pause/resume every GSAP animation on the page.
  useEffect(() => {
    if (state.paused) gsap.globalTimeline.pause()
    else gsap.globalTimeline.resume()
  }, [state.paused])

  useEffect(() => {
    document.title = `${current.number}. ${current.title} — Network Latency Predictor`
  }, [current])

  const handlers = useMemo<ShortcutHandlers>(
    () => ({
      next: () => dispatch({ type: 'next' }),
      previous: () => dispatch({ type: 'previous' }),
      advance: () => dispatch({ type: 'advance' }),
      toggleFullscreen: () => void toggleFullscreen(),
      toggleNotes: () => dispatch({ type: 'toggleNotes' }),
      togglePause: () => dispatch({ type: 'togglePause' }),
      replay: () => dispatch({ type: 'replay' }),
      restart: () => dispatch({ type: 'restart' }),
      goto: (chapter) => dispatch({ type: 'goto', chapter }),
      escape: () => {},
    }),
    [toggleFullscreen],
  )
  useKeyboardShortcuts(handlers, popup)

  const onNextChapter = useCallback(() => dispatch({ type: 'next' }), [])

  // After a mouse click, drop focus from the button so Space keeps meaning "advance".
  const releaseMouseFocus = (event: React.PointerEvent) => {
    if (event.pointerType !== 'mouse') return
    const el = document.activeElement as HTMLElement | null
    if (el && (el.tagName === 'BUTTON' || el.getAttribute('role') === 'tab')) el.blur()
  }

  const showDrawer = state.notesOpen && !isFullscreen && !notesWindow
  const notes = <PresenterNotesPanel chapter={current} step={state.step} inWindow />

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div
        ref={rootRef}
        data-testid="presentation-root"
        className={`relative flex min-w-0 flex-1 flex-col ${isFullscreen ? 'bg-black' : ''}`}
        onPointerUp={releaseMouseFocus}
      >
        <div className={`relative min-h-0 flex-1 ${isFullscreen ? '' : 'p-4'}`}>
          <Stage tone={current.tone}>
            <Suspense fallback={<div className="absolute inset-0" aria-busy="true" />}>
              <section key={`${current.id}-${state.replayKey}`} data-testid={`chapter-${current.number}`} aria-roledescription="chapter" aria-label={current.title} className="absolute inset-0">
                <Chapter step={state.step} onNextChapter={onNextChapter} />
              </section>
            </Suspense>
          </Stage>
          {state.paused && (
            <div className="presenter-only pointer-events-none absolute top-6 right-6 rounded bg-charcoal/85 px-3 py-1 text-[13px] font-semibold text-ivory" role="status">
              Animation paused
            </div>
          )}
        </div>
        <ControlBar
          chapters={chapters}
          chapter={state.chapter}
          step={state.step}
          paused={state.paused}
          notesOpen={state.notesOpen}
          isFullscreen={isFullscreen}
          overlay={isFullscreen}
          onPrevious={handlers.previous}
          onNext={handlers.next}
          onAdvance={handlers.advance}
          onGoto={handlers.goto}
          onReplay={handlers.replay}
          onTogglePause={handlers.togglePause}
          onToggleNotes={handlers.toggleNotes}
          onToggleFullscreen={handlers.toggleFullscreen}
          onRestart={handlers.restart}
        />
      </div>

      {showDrawer && (
        <aside className="w-[400px] shrink-0 max-md:absolute max-md:inset-0 max-md:z-30 max-md:w-full">
          <PresenterNotesPanel
            chapter={current}
            step={state.step}
            onPopOut={() => setNotesWindow(true)}
            onClose={() => dispatch({ type: 'toggleNotes' })}
          />
        </aside>
      )}
      {notesWindow && (
        <PresenterWindow onClose={() => setNotesWindow(false)} onReady={setPopup}>
          {notes}
        </PresenterWindow>
      )}
    </div>
  )
}
