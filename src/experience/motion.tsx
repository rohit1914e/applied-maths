import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import gsap from 'gsap'

// eslint-disable-next-line react/only-export-components
export const SPEEDS = [0.5, 1, 1.5, 2] as const

export interface MotionSettings {
  readonly paused: boolean
  readonly speed: number
  readonly reduced: boolean
  readonly setPaused: (paused: boolean) => void
  readonly setSpeed: (speed: number) => void
  readonly setReduced: (reduced: boolean) => void
}

// eslint-disable-next-line react/only-export-components
export const MotionContext = createContext<MotionSettings | null>(null)

const prefersReduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Global motion settings: pause, speed and reduced motion. GSAP's global timeline follows
 * them, so every tween in every scene pauses and changes speed together.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  const [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [reduced, setReduced] = useState(prefersReduced)

  useEffect(() => {
    gsap.globalTimeline.timeScale(speed)
  }, [speed])
  useEffect(() => {
    if (paused) gsap.globalTimeline.pause()
    else gsap.globalTimeline.resume()
  }, [paused])

  const value = useMemo(() => ({ paused, speed, reduced, setPaused, setSpeed, setReduced }), [paused, speed, reduced])
  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>
}

// eslint-disable-next-line react/only-export-components
export function useMotion(): MotionSettings {
  const value = useContext(MotionContext)
  if (!value) throw new Error('useMotion must be used inside <MotionProvider>.')
  return value
}

/**
 * Runs `callback(dtSeconds)` once per animation frame while `enabled`. The frame loop exists
 * only while enabled, so a paused, hidden or off-screen scene costs nothing.
 * `dt` already includes the speed multiplier.
 */
// eslint-disable-next-line react/only-export-components
export function useTicker(callback: (dt: number) => void, enabled: boolean, speed: number): void {
  const ref = useRef(callback)
  const speedRef = useRef(speed)
  useEffect(() => {
    ref.current = callback
    speedRef.current = speed
  })
  useEffect(() => {
    if (!enabled) return
    let frame = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      ref.current(dt * speedRef.current)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [enabled])
}
