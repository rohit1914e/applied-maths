import type { ComponentType } from 'react'
import type { Beat } from '../experience/timeline'

export interface PresenterNotes {
  /** what to explain, in order */
  readonly explain: readonly string[]
  readonly terms: readonly { readonly term: string; readonly meaning: string }[]
  readonly narration: string
  /** optional formula walkthrough (plain text) */
  readonly formula?: string
  readonly questions: readonly { readonly q: string; readonly a: string }[]
}

export interface SceneDefinition {
  readonly id: string
  readonly number: number
  readonly title: string
  /** scroll length in screens */
  readonly length: number
  /** presenter stops inside the scene; the first is always at 0 */
  readonly beats: readonly Beat[]
  readonly notes: PresenterNotes
  readonly load: () => Promise<{ default: ComponentType }>
}
