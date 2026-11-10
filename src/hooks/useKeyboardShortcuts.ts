import { useEffect } from 'react'

export interface ShortcutHandlers {
  nextBeat: () => void
  previousBeat: () => void
  nextScene: () => void
  previousScene: () => void
  goto: (sceneIndex: number) => void
  toggleFullscreen: () => void
  toggleNotes: () => void
  togglePause: () => void
  toggleReducedMotion: () => void
  faster: () => void
  slower: () => void
  replay: () => void
  restart: () => void
}

const TYPING = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/**
 * Presenter keys. Clickers send PageDown/PageUp, so those step beats like Space and the
 * vertical arrows. Keys typed into form fields are ignored, and Space on a focused button
 * keeps its normal "press" behaviour.
 */
export function handleShortcut(event: KeyboardEvent, h: ShortcutHandlers, sceneCount: number): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return false
  const target = event.target as HTMLElement | null
  if (target && (TYPING.has(target.tagName) || target.isContentEditable)) return false

  switch (event.key) {
    case ' ':
    case 'Spacebar':
      if (target && (target.tagName === 'BUTTON' || target.tagName === 'A' || target.getAttribute('role') === 'tab')) return false
      if (event.shiftKey) h.previousBeat()
      else h.nextBeat()
      return true
    case 'ArrowDown':
    case 'PageDown':
      h.nextBeat()
      return true
    case 'ArrowUp':
    case 'PageUp':
      h.previousBeat()
      return true
    case 'ArrowRight':
      h.nextScene()
      return true
    case 'ArrowLeft':
      h.previousScene()
      return true
    case 'f':
    case 'F':
      h.toggleFullscreen()
      return true
    case 'n':
    case 'N':
      h.toggleNotes()
      return true
    case 'p':
    case 'P':
      h.togglePause()
      return true
    case 'm':
    case 'M':
      h.toggleReducedMotion()
      return true
    case '+':
    case '=':
      h.faster()
      return true
    case '-':
    case '_':
      h.slower()
      return true
    case 'r':
    case 'R':
      h.replay()
      return true
    case 'Home':
      h.restart()
      return true
    default:
      if (/^[1-9]$/.test(event.key) && Number(event.key) <= sceneCount) {
        h.goto(Number(event.key) - 1)
        return true
      }
      return false
  }
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers, sceneCount: number, extraWindow?: Window | null) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (handleShortcut(event, handlers, sceneCount)) event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    extraWindow?.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      extraWindow?.removeEventListener('keydown', onKey)
    }
  }, [handlers, sceneCount, extraWindow])
}
