import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

/**
 * True while the element overlaps the viewport. Used to stop frame loops for sections that
 * are scrolled away. Without IntersectionObserver (tests) the element counts as visible.
 */
export function useInView<T extends Element>(ref: RefObject<T | null>, rootMargin = '0px'): boolean {
  const [inView, setInView] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, rootMargin])
  return inView
}

/** Calls `onEnter` once, the first time the element comes into view (for one-off constructions). */
export function useFirstView<T extends Element>(ref: RefObject<T | null>, onEnter: () => void, threshold = 0.25): void {
  const cb = useRef(onEnter)
  useEffect(() => {
    cb.current = onEnter
  })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      cb.current()
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          cb.current()
          observer.disconnect()
        }
      },
      { threshold },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, threshold])
}

/** Width of an element in CSS pixels, tracked with ResizeObserver (charts draw at real size). */
export function useElementWidth<T extends HTMLElement>(fallback = 800): [RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      if (el.clientWidth > 0) setWidth(el.clientWidth)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}
