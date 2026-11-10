/**
 * Maps one continuous scroll position onto the story's scenes. Units are viewport heights
 * ("screens"): a scene of length 4 takes four screens of scrolling.
 *
 * Each scene after the first begins with an entry window during which it cross-fades over
 * the previous scene. Its own content progress (0 → 1) runs over the rest of its length.
 */

export interface SceneSpan {
  readonly start: number
  readonly length: number
  /** screens spent cross-fading in from the previous scene (0 for the first scene) */
  readonly entry: number
}

export interface Beat {
  /** content progress (0–1) where this beat sits */
  readonly at: number
  readonly label: string
  /** seconds a keyboard step takes to arrive here at 1× speed (longer for constructions) */
  readonly seconds?: number
}

export const ENTRY_SCREENS = 0.6

export function layoutScenes(lengths: readonly number[], entry = ENTRY_SCREENS): SceneSpan[] {
  let start = 0
  return lengths.map((length, i) => {
    const span = { start, length, entry: i === 0 ? 0 : Math.min(entry, length / 2) }
    start += length
    return span
  })
}

export function totalLength(spans: readonly SceneSpan[]): number {
  const last = spans[spans.length - 1]
  return last ? last.start + last.length : 0
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

export interface Location {
  readonly index: number
  /** content progress of the scene at `index` */
  readonly local: number
  /** how far the scene at `index` has faded in (1 once its entry window is over) */
  readonly enter: number
}

export function locate(spans: readonly SceneSpan[], position: number): Location {
  const end = totalLength(spans)
  const g = Math.min(Math.max(position, 0), end)
  let index = spans.findIndex((s) => g >= s.start && g < s.start + s.length)
  if (index < 0) index = spans.length - 1
  const s = spans[index]
  const enter = s.entry > 0 ? clamp01((g - s.start) / s.entry) : 1
  const local = clamp01((g - s.start - s.entry) / (s.length - s.entry))
  return { index, local, enter }
}

/** Opacity of every scene that should be on screen at this position. */
export function visibleScenes(spans: readonly SceneSpan[], position: number): { index: number; opacity: number }[] {
  const { index, enter } = locate(spans, position)
  if (enter >= 1 || index === 0) return [{ index, opacity: 1 }]
  return [
    { index: index - 1, opacity: 1 - enter },
    { index, opacity: enter },
  ]
}

/** Scroll position (screens) of a beat inside a scene. */
export function beatPosition(spans: readonly SceneSpan[], sceneIndex: number, at: number): number {
  const s = spans[sceneIndex]
  return s.start + s.entry + clamp01(at) * (s.length - s.entry)
}

export interface BeatStop {
  readonly scene: number
  readonly beat: number
  readonly position: number
  readonly seconds: number
}

export function allBeatStops(spans: readonly SceneSpan[], beats: readonly (readonly Beat[])[]): BeatStop[] {
  return beats.flatMap((list, scene) =>
    list.map((b, beat) => ({ scene, beat, position: beatPosition(spans, scene, b.at), seconds: b.seconds ?? 1.1 })),
  )
}

const EPS = 1e-3

/** The next (dir = 1) or previous (dir = −1) beat stop from a position. */
export function stepBeat(stops: readonly BeatStop[], position: number, dir: 1 | -1): BeatStop | null {
  if (dir === 1) return stops.find((s) => s.position > position + EPS) ?? null
  for (let i = stops.length - 1; i >= 0; i--) if (stops[i].position < position - EPS) return stops[i]
  return null
}

/** The beat the presenter is currently on (the last stop at or before the position). */
export function currentBeat(stops: readonly BeatStop[], position: number): BeatStop {
  let found = stops[0]
  for (const s of stops) if (s.position <= position + EPS) found = s
  return found
}

/** Content progress → progress within [a, b], clamped. Used by scenes for sub-steps. */
export function segment(p: number, a: number, b: number): number {
  return clamp01((p - a) / (b - a))
}
