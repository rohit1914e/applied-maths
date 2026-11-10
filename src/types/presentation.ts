import type { ComponentType } from 'react'

export interface ChapterProps {
  /** current build inside the chapter, 0 … builds */
  readonly step: number
  /** go to the next chapter (used by explicit controls such as "Start presentation") */
  readonly onNextChapter: () => void
}

export interface PresenterNotes {
  /** what to explain, in order */
  readonly explain: readonly string[]
  readonly terms: readonly { readonly term: string; readonly meaning: string }[]
  readonly narration: string
  /** optional formula walkthrough (plain text) */
  readonly formula?: string
  readonly questions: readonly { readonly q: string; readonly a: string }[]
}

export interface ChapterDefinition {
  readonly id: string
  readonly number: number
  readonly title: string
  /** number of presenter-triggered builds after the initial composition */
  readonly builds: number
  /** names shown in the control bar for each build (length = builds) */
  readonly buildLabels: readonly string[]
  readonly tone: 'light' | 'dark'
  readonly notes: PresenterNotes
  readonly load: () => Promise<{ default: ComponentType<ChapterProps> }>
}
