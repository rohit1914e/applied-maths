import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useReducedMotion } from './useReducedMotion'

/**
 * A 0 → 1 construction progress, animated with GSAP whenever `play()` is called or `key`
 * changes after the first play. Charts read the value to draw curves, morph polynomials and
 * reveal intermediate values. With reduced motion it is always 1 (the finished result).
 */
export function useConstruction(key: string, seconds: number): { s: number; play: () => void; playing: boolean } {
  const reduced = useReducedMotion()
  const [s, setS] = useState(reduced ? 1 : 0)
  const [playing, setPlaying] = useState(false)
  const started = useRef(false)
  const tween = useRef<gsap.core.Tween | null>(null)

  const play = useCallback(() => {
    started.current = true
    tween.current?.kill()
    if (reduced) {
      setS(1)
      return
    }
    const proxy = { s: 0 }
    setS(0)
    setPlaying(true)
    tween.current = gsap.to(proxy, {
      s: 1,
      duration: seconds,
      ease: 'power1.inOut',
      onUpdate: () => setS(proxy.s),
      onComplete: () => setPlaying(false),
    })
  }, [reduced, seconds])

  // replay automatically when the thing being constructed changes, once the section has been seen
  useEffect(() => {
    if (started.current) play()
  }, [key, play])

  useEffect(() => () => void tween.current?.kill(), [])

  return { s: reduced ? 1 : s, play, playing }
}
