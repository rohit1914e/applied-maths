export interface PresentationState {
  readonly chapter: number
  readonly step: number
  readonly paused: boolean
  readonly notesOpen: boolean
  /** bumping this remounts the active chapter, resetting its demonstration */
  readonly replayKey: number
}

export type PresentationAction =
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'goto'; chapter: number }
  /** Space: next build, or the next chapter once every build is shown */
  | { type: 'advance' }
  | { type: 'replay' }
  | { type: 'togglePause' }
  | { type: 'toggleNotes' }
  | { type: 'restart' }

export function createInitialState(): PresentationState {
  return { chapter: 0, step: 0, paused: false, notesOpen: false, replayKey: 0 }
}

/**
 * Pure reducer; `builds[i]` is the number of builds in chapter i. Nothing here runs on a
 * timer, so the presentation can only move when the presenter acts.
 */
export function presentationReducer(
  state: PresentationState,
  action: PresentationAction,
  builds: readonly number[],
): PresentationState {
  const last = builds.length - 1
  const enter = (chapter: number): PresentationState =>
    chapter === state.chapter ? state : { ...state, chapter, step: 0, paused: false }

  switch (action.type) {
    case 'next':
      return enter(Math.min(last, state.chapter + 1))
    case 'previous':
      return enter(Math.max(0, state.chapter - 1))
    case 'goto':
      return enter(Math.min(last, Math.max(0, action.chapter)))
    case 'advance':
      if (state.step < builds[state.chapter]) return { ...state, step: state.step + 1 }
      return enter(Math.min(last, state.chapter + 1))
    case 'replay':
      return { ...state, step: 0, paused: false, replayKey: state.replayKey + 1 }
    case 'togglePause':
      return { ...state, paused: !state.paused }
    case 'toggleNotes':
      return { ...state, notesOpen: !state.notesOpen }
    case 'restart':
      return { ...createInitialState(), notesOpen: state.notesOpen, replayKey: state.replayKey + 1 }
  }
}
