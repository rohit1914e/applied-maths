/** Scroll progress → pipeline timeline (0–1). The scene's beats sit on the stage ends. */
export const PIPELINE_SPAN = [0.02, 0.94] as const
export const STAGE_ENDS = [0.2, 0.44, 0.64, 0.8, 1] as const

/** Content progress at which pipeline stage `k` has finished. */
export const stageEndProgress = (k: number) => PIPELINE_SPAN[0] + STAGE_ENDS[k] * (PIPELINE_SPAN[1] - PIPELINE_SPAN[0])
