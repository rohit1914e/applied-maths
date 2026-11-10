import { useEffect, useRef, useSyncExternalStore } from 'react'

/**
 * A tiny observable number. Scroll position and scene progress change on every frame, so
 * they live here instead of React state: components either subscribe imperatively
 * (no re-render) or select a derived primitive that changes rarely.
 */
export interface NumberStore {
  get(): number
  set(value: number): void
  subscribe(listener: () => void): () => void
}

export function createStore(initial = 0): NumberStore {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set(next) {
      if (next === value) return
      value = next
      listeners.forEach((l) => l())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/** Re-renders on every change. Use for light SVG scenes that genuinely redraw per frame. */
export function useStoreValue(store: NumberStore): number {
  return useSyncExternalStore(store.subscribe, store.get, store.get)
}

/** Re-renders only when the selected primitive changes (for example the current beat). */
export function useStoreSelector<T extends string | number | boolean>(store: NumberStore, select: (value: number) => T): T {
  const selectRef = useRef(select)
  useEffect(() => {
    selectRef.current = select
  })
  return useSyncExternalStore(
    store.subscribe,
    () => selectRef.current(store.get()),
    () => selectRef.current(store.get()),
  )
}

/** Calls `listener` now and on every change, without re-rendering (for GSAP scrubbing). */
export function useStoreListener(store: NumberStore, listener: (value: number) => void): void {
  const ref = useRef(listener)
  useEffect(() => {
    ref.current = listener
  })
  useEffect(() => {
    const run = () => ref.current(store.get())
    run()
    return store.subscribe(run)
  }, [store])
}
