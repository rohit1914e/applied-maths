import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { createSyntheticBundle } from '../data/datasets'
import { planExperiment, runAccuracyExperiment, type AccuracyExperiment } from '../evaluation/comparison/compareMethods'
import { DEFAULT_NODE_COUNT } from '../reconstruction/reconstruct'
import type { InterpolationMethod } from '../types/interpolation'
import type { DatasetBundle, ReconstructionOutcome } from '../types/measurement'

const DEFAULT_HOLDOUT = { percent: 20, seed: 11 }

interface DatasetContextValue {
  readonly bundle: DatasetBundle
  readonly setBundle: (bundle: DatasetBundle) => void
  readonly method: InterpolationMethod
  readonly setMethod: (method: InterpolationMethod) => void
  readonly nodeCount: number
  readonly setNodeCount: (count: number) => void
  /** reconstructions accepted in chapter 6, keyed by measurement index */
  readonly reconstructions: ReadonlyMap<number, ReconstructionOutcome>
  readonly recordReconstructions: (outcomes: readonly ReconstructionOutcome[]) => void
  readonly clearReconstructions: () => void
  readonly holdout: { percent: number; seed: number }
  readonly setHoldout: (holdout: { percent: number; seed: number }) => void
  /** chapter 7 experiment, recomputed from live algorithm output whenever inputs change */
  readonly experiment: AccuracyExperiment | null
  readonly experimentError: string | null
}

const DatasetContext = createContext<DatasetContextValue | null>(null)

export function DatasetProvider({ children, initial }: { children: ReactNode; initial?: DatasetBundle }) {
  const [bundle, setBundleState] = useState<DatasetBundle>(() => initial ?? createSyntheticBundle())
  const [method, setMethod] = useState<InterpolationMethod>('spline')
  const [nodeCount, setNodeCount] = useState(DEFAULT_NODE_COUNT)
  const [reconstructions, setReconstructions] = useState<ReadonlyMap<number, ReconstructionOutcome>>(new Map())
  const [holdout, setHoldout] = useState(DEFAULT_HOLDOUT)

  const setBundle = useCallback((next: DatasetBundle) => {
    setBundleState(next)
    setReconstructions(new Map())
  }, [])

  const recordReconstructions = useCallback((outcomes: readonly ReconstructionOutcome[]) => {
    setReconstructions((previous) => {
      const next = new Map(previous)
      for (const o of outcomes) if (o.ok) next.set(o.index, o)
      return next
    })
  }, [])

  const clearReconstructions = useCallback(() => setReconstructions(new Map()), [])

  const { experiment, experimentError } = useMemo(() => {
    try {
      const plan = planExperiment(bundle, holdout.percent, holdout.seed)
      if (plan.hiddenPositions.length === 0) {
        return { experiment: null, experimentError: 'No measurements are hidden, so there is nothing to evaluate. Increase the missing percentage in chapter 4.' }
      }
      return { experiment: runAccuracyExperiment(plan.reference, plan.hiddenPositions, nodeCount), experimentError: null }
    } catch (error) {
      return { experiment: null, experimentError: error instanceof Error ? error.message : String(error) }
    }
  }, [bundle, holdout, nodeCount])

  const value = useMemo<DatasetContextValue>(
    () => ({
      bundle,
      setBundle,
      method,
      setMethod,
      nodeCount,
      setNodeCount,
      reconstructions,
      recordReconstructions,
      clearReconstructions,
      holdout,
      setHoldout,
      experiment,
      experimentError,
    }),
    [bundle, setBundle, method, nodeCount, reconstructions, recordReconstructions, clearReconstructions, holdout, experiment, experimentError],
  )

  return <DatasetContext.Provider value={value}>{children}</DatasetContext.Provider>
}

// eslint-disable-next-line react/only-export-components
export function useDataset(): DatasetContextValue {
  const value = useContext(DatasetContext)
  if (!value) throw new Error('useDataset must be used inside <DatasetProvider>.')
  return value
}
