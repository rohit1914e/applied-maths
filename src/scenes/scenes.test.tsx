import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentType } from 'react'
import { MotionProvider } from '../experience/motion'
import { SceneContext } from '../experience/SceneContext'
import { createStore } from '../experience/store'
import { DatasetProvider } from '../state/DatasetContext'
import { createSyntheticBundle } from '../data/datasets'
import { reconstruct } from '../reconstruction/reconstruct'
import { chooseFocusGap } from '../reconstruction/focus'
import { planExperiment, runAccuracyExperiment } from '../evaluation/comparison/compareMethods'
import { fmt } from '../utils/format'
import App from '../app/App'
import { SCENES } from '../app/scenes'
import LiveNetwork from './LiveNetwork/LiveNetwork'
import MissingData from './MissingData/MissingData'
import Preparation from './Preparation/Preparation'
import Interpolation from './Interpolation/Interpolation'
import Reconstruction from './Reconstruction/Reconstruction'
import Accuracy from './Accuracy/Accuracy'
import Conclusion from './Conclusion/Conclusion'

/** Renders one scene with its content progress fixed at `p` (no scrolling needed). */
function renderScene(Scene: ComponentType, p: number) {
  const progress = createStore(p)
  const utils = render(
    <MotionProvider>
      <DatasetProvider>
        <SceneContext.Provider value={{ index: 0, progress, exit: createStore(0), playing: false, reduced: true, speed: 1, goTo: vi.fn() }}>
          <Scene />
        </SceneContext.Provider>
      </DatasetProvider>
    </MotionProvider>,
  )
  return { ...utils, progress }
}

const bundle = createSyntheticBundle()

function withReducedMotion<T>(fn: () => T): T {
  const original = window.matchMedia
  window.matchMedia = ((q: string) => ({ ...original(q), matches: q.includes('reduce') })) as typeof window.matchMedia
  try {
    return fn()
  } finally {
    window.matchMedia = original
  }
}

describe('experience shell', () => {
  it('opens on the live network and moves through scenes with the keyboard', async () => {
    const user = userEvent.setup()
    withReducedMotion(() => render(<App />))
    expect(await screen.findByTestId('live-readouts')).toBeInTheDocument()
    await user.keyboard('3')
    expect(await screen.findByText(/raw records arrive in network order/)).toBeInTheDocument()
    await user.keyboard('{Home}')
    expect(await screen.findByTestId('live-readouts')).toBeInTheDocument()
  })

  it('keeps presenter notes outside the stage and the fullscreen root', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByTestId('live-readouts')
    await user.keyboard('n')
    const notes = await screen.findByTestId('presenter-notes')
    expect(screen.getByTestId('stage')).not.toContainElement(notes)
    expect(screen.getByTestId('presentation-root')).not.toContainElement(notes)
    expect(within(notes).getByText(SCENES[0].notes.questions[0].q)).toBeInTheDocument()
    expect(within(notes).getByRole('list', { name: 'Steps in this scene' }).children).toHaveLength(SCENES[0].beats.length)
  })

  it('offers pause, speed, reduced motion, replay, restart, presenter mode and the scene list', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByTestId('live-readouts')
    const bar = screen.getByTestId('control-bar')
    for (const name of ['Previous step', 'Next step', 'Pause', 'Reduced motion', 'Replay scene', 'Restart', 'Presenter mode', 'Fullscreen']) {
      expect(within(bar).getByRole('button', { name })).toBeInTheDocument()
    }
    await user.click(within(bar).getByRole('button', { name: 'Pause' }))
    expect(screen.getByRole('status')).toHaveTextContent('Animation paused')
    await user.selectOptions(within(bar).getByLabelText('Animation speed'), '1.5')
    expect(within(bar).getByLabelText('Animation speed')).toHaveValue('1.5')
    await user.click(within(bar).getByRole('button', { name: 'Reduced motion' }))
    expect(within(bar).getByRole('button', { name: 'Reduced motion' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(bar).getByRole('button', { name: /Understanding Network Latency/ }))
    expect(within(screen.getByRole('menu', { name: 'Scenes' })).getAllByRole('menuitem')).toHaveLength(7)
  })
})

describe('scenes show live algorithm output', () => {
  it('scene 1: readouts and timeout gaps come from the simulated probes', () => {
    renderScene(LiveNetwork, 1)
    const gaps = screen.getAllByTestId('trace-gap').length
    expect(within(screen.getByTestId('live-readouts')).getByText('Timeouts').nextElementSibling).toHaveTextContent(`${gaps}of 60`)
    expect(screen.getByTestId('caption-2')).toHaveTextContent(`${gaps} of the last 60 probes`)
  })

  it('scene 2: the gaps appear and the facts are computed from the dataset', () => {
    renderScene(MissingData, 0.9)
    for (const i of bundle.missingIndices) expect(screen.getByTestId(`vanished-${i}`)).toBeInTheDocument()
    const observed = bundle.observed.measurements.length - bundle.missingIndices.length
    expect(screen.getByTestId('why-gaps')).toHaveTextContent(`${observed} of ${bundle.observed.measurements.length}`)
    expect(screen.getByTestId('causes')).toHaveTextContent('The reply came too late')
  })

  it('scene 3: the pipeline reports the injected faults and the clean dataset', () => {
    renderScene(Preparation, 1)
    expect(screen.getByTestId('pipeline-caption')).toHaveTextContent(`${bundle.observed.measurements.length} records, ${bundle.observed.measurements.length - bundle.missingIndices.length} measured and ${bundle.missingIndices.length} missing`)
    for (const reason of ['is not a number', 'negative latency', 'duplicate timestamp', 'no timestamp']) {
      expect(screen.getAllByText(new RegExp(reason)).length).toBeGreaterThan(0)
    }
  })

  it('scene 4: each method shows the value computed by the algorithm, and Newton equals Lagrange', () => {
    const focus = chooseFocusGap(bundle)!
    const value = (method: 'lagrange' | 'newton' | 'spline') => {
      const [o] = reconstruct(bundle.observed, [focus], { method, nodeCount: 4 })
      if (!o.ok) throw new Error('expected an estimate')
      return o.value
    }
    const { progress } = renderScene(Interpolation, 0.3)
    expect(screen.getByTestId('interp-estimate')).toHaveTextContent(`${fmt(value('lagrange'), 2)} ms`)
    expect(screen.getByTestId('basis-panel')).toBeInTheDocument()
    act(() => progress.set(0.55))
    expect(screen.getByTestId('divided-differences')).toBeInTheDocument()
    expect(screen.getByTestId('interp-estimate')).toHaveTextContent(`${fmt(value('newton'), 2)} ms`)
    act(() => progress.set(0.8))
    expect(screen.getByTestId('interp-estimate')).toHaveTextContent(`${fmt(value('spline'), 2)} ms`)
    act(() => progress.set(0.95))
    const cells = within(screen.getByTestId('compare-table')).getAllByText(/ms$/)
    expect(cells[0].textContent).toBe(cells[1].textContent)
  })

  it('scene 5: estimates appear one by one and match the reconstruction pipeline', () => {
    const outcomes = reconstruct(bundle.observed, bundle.missingIndices, { method: 'spline', nodeCount: 4 })
    const { progress } = renderScene(Reconstruction, 0)
    expect(screen.getByTestId('reconstruction-status')).toHaveTextContent(`${outcomes.length} records are missing`)
    act(() => progress.set(1))
    expect(screen.getByTestId('reconstruction-status')).toHaveTextContent(`${outcomes.length} of ${outcomes.length} gaps estimated`)
    for (const o of outcomes) {
      if (o.ok) expect(screen.getByTestId(`reconstructed-${o.index}`)).toBeInTheDocument()
    }
    const log = screen.getByTestId('reconstruction-log')
    const last = outcomes.at(-1)!
    if (last.ok) expect(log).toHaveTextContent(`${fmt(last.value, 2)} ms`)
  })

  it('scene 6: running metrics equal the evaluation module once every pair is revealed', () => {
    const plan = planExperiment(bundle, 20, 11)
    const spline = runAccuracyExperiment(plan.reference, plan.hiddenPositions, 4).results.find((r) => r.method === 'spline')!
    renderScene(Accuracy, 0.9)
    const metrics = screen.getByTestId('running-metrics')
    expect(metrics).toHaveTextContent(fmt(spline.metrics!.mae, 3))
    expect(metrics).toHaveTextContent(fmt(spline.metrics!.rmse, 3))
    expect(metrics).toHaveTextContent(fmt(spline.metrics!.maxAbsError, 3))
    expect(screen.getAllByTestId('error-pair')).toHaveLength(plan.hiddenPositions.length)
    expect(screen.getByTestId('interpretation')).toHaveTextContent('does not validate any estimate')
  })

  it('scene 7: summary from live results, then credits', () => {
    const { progress } = renderScene(Conclusion, 0.4)
    expect(screen.getByTestId('conclusion-metrics')).toHaveTextContent('ms')
    act(() => progress.set(1))
    expect(screen.getByTestId('credits')).toHaveTextContent('Numerical Methods')
  })
})
