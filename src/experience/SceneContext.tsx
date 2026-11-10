import { createContext, useContext } from 'react'
import type { NumberStore } from './store'

export interface SceneRuntime {
  readonly index: number
  /** content progress of this scene, 0 → 1, driven by scrolling */
  readonly progress: NumberStore
  /** 0 while the scene is fully shown, rising to 1 as the next scene fades in over it */
  readonly exit: NumberStore
  /** ambient animation may run: not paused, motion allowed, scene on screen */
  readonly playing: boolean
  readonly reduced: boolean
  readonly speed: number
  /** scroll (with the presenter's speed and pause respected) to a content position */
  readonly goTo: (at: number) => void
}

export const SceneContext = createContext<SceneRuntime | null>(null)

export function useScene(): SceneRuntime {
  const value = useContext(SceneContext)
  if (!value) throw new Error('useScene must be used inside a scene.')
  return value
}
