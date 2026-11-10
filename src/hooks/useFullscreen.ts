import { useCallback, useEffect, useState, type RefObject } from 'react'

/**
 * Fullscreen for one element (the stage). Only that element is projected, so anything
 * outside it — the presenter notes drawer — can never appear in fullscreen output.
 */
export function useFullscreen(target: RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const update = () => setIsFullscreen(document.fullscreenElement !== null && document.fullscreenElement === target.current)
    document.addEventListener('fullscreenchange', update)
    return () => document.removeEventListener('fullscreenchange', update)
  }, [target])

  const toggle = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await target.current?.requestFullscreen()
    } catch {
      // Fullscreen can be refused (iframe policy, no user gesture); the stage still works windowed.
    }
  }, [target])

  return { isFullscreen, toggle }
}
