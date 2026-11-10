import { useContext, useSyncExternalStore } from 'react'
import { MotionContext } from '../experience/motion'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

/**
 * True when motion should be reduced: the presenter's toggle when inside the experience,
 * otherwise the operating-system preference.
 */
export function useReducedMotion(): boolean {
  const settings = useContext(MotionContext)
  const os = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
  return settings ? settings.reduced : os
}
