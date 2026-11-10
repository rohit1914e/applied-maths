import { useEffect } from 'react'

export interface ShortcutHandlers {
  next: () => void
  previous: () => void
  advance: () => void
  toggleFullscreen: () => void
  toggleNotes: () => void
  togglePause: () => void
  replay: () => void
  restart: () => void
  goto: (chapterIndex: number) => void
  escape: () => void
}

const TYPING = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/**
 * Presentation keys. Clickers send PageDown/PageUp, so those mirror the arrows.
 * Keys typed into form fields are ignored, and Space on a focused button keeps its
 * normal "press" behaviour.
 */
export function handleShortcut(event: KeyboardEvent, h: ShortcutHandlers): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return false
  const target = event.target as HTMLElement | null
  if (target && (TYPING.has(target.tagName) || target.isContentEditable)) return false

  switch (event.key) {
    case 'ArrowRight':
    case 'PageDown':
      h.next()
      return true
    case 'ArrowLeft':
    case 'PageUp':
      h.previous()
      return true
    case ' ':
    case 'Spacebar':
      if (target && (target.tagName === 'BUTTON' || target.tagName === 'A' || target.getAttribute('role') === 'tab')) return false
      h.advance()
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
    case 'r':
    case 'R':
      h.replay()
      return true
    case 'Home':
      h.restart()
      return true
    case 'Escape':
      h.escape()
      return false // let the browser exit fullscreen too
    default:
      if (/^[1-8]$/.test(event.key)) {
        h.goto(Number(event.key) - 1)
        return true
      }
      return false
  }
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers, extraWindow?: Window | null) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (handleShortcut(event, handlers)) event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    extraWindow?.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      extraWindow?.removeEventListener('keydown', onKey)
    }
  }, [handlers, extraWindow])
}
