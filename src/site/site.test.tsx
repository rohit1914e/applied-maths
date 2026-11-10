import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../app/App'
import { createSyntheticBundle } from '../data/datasets'
import { reconstruct } from '../reconstruction/reconstruct'
import { chooseFocusGap } from '../reconstruction/focus'
import { planExperiment, runAccuracyExperiment } from '../evaluation/comparison/compareMethods'
import { fmt, fmtSeconds } from '../utils/format'
import { NAV_LINKS } from './navLinks'

// Reduced motion: constructions render their finished state and the simulations stay still,
// so assertions see final values without waiting for animations.
const original = window.matchMedia
beforeEach(() => {
  window.matchMedia = ((q: string) => ({ ...original(q), matches: q.includes('reduce') })) as typeof window.matchMedia
})
afterEach(() => {
  window.matchMedia = original
})

const bundle = createSyntheticBundle()
const section = (id: string) => document.getElementById(id) as HTMLElement

describe('website structure', () => {
  it('has a navigation bar, a hero and every section, without a presentation toolbar', () => {
    render(<App />)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    for (const link of NAV_LINKS) {
      expect(within(nav).getByRole('link', { name: link.label })).toHaveAttribute('href', `#${link.id}`)
      expect(section(link.id)).toBeInTheDocument()
    }
    expect(screen.getByRole('heading', { level: 1, name: 'Network Latency Predictor' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Explore the simulation' })).toHaveAttribute('href', '#simulation')
    for (const id of ['missing-data', 'conclusion']) expect(section(id)).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Presentation controls' })).toBeNull()
    expect(screen.queryByTestId('stage')).toBeNull()
  })

  it('opens and closes the mobile menu', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Menu/ }))
    const menu = document.getElementById('mobile-nav')!
    expect(within(menu).getAllByRole('link')).toHaveLength(NAV_LINKS.length)
    await user.click(within(menu).getByRole('link', { name: 'Methods' }))
    expect(document.getElementById('mobile-nav')).toBeNull()
  })
})

describe('hero and simulation', () => {
  it('shows live metrics computed from the simulated probes', () => {
    render(<App />)
    const metrics = screen.getByTestId('hero-metrics')
    expect(within(metrics).getByText('Latest RTT')).toBeInTheDocument()
    expect(within(metrics).getByText('Timeouts').nextElementSibling!.textContent).toMatch(/^\d+of 60$/)
  })

  it('pauses, resumes, resets and changes speed and loss rate', async () => {
    const user = userEvent.setup()
    render(<App />)
    const sim = section('simulation')
    // reduced motion starts the simulation paused
    expect(within(sim).getByTestId('sim-status')).toHaveTextContent('Paused')
    await user.click(within(sim).getByRole('button', { name: 'Resume' }))
    expect(within(sim).getByTestId('sim-status')).toHaveTextContent('Running at 1×')
    await user.click(within(sim).getByRole('button', { name: '2×' }))
    expect(within(sim).getByTestId('sim-status')).toHaveTextContent('Running at 2×')
    await user.click(within(sim).getByRole('button', { name: 'Pause' }))
    expect(within(sim).getByTestId('sim-status')).toHaveTextContent('Paused')
    await user.click(within(sim).getByRole('button', { name: 'Reset' }))
    expect(within(sim).getByTestId('probe-counter')).toHaveTextContent('probe #60')
    const slider = within(sim).getByLabelText(/Lost replies/)
    expect(slider).toHaveValue('6')
    expect(within(sim).getAllByTestId('trace-gap').length).toBe(Number(within(sim).getByTestId('timeout-stat').textContent!.match(/Timeouts(\d+)/)![1]))
  })
})

describe('missing data and dataset', () => {
  it('toggles between the complete and incomplete series', async () => {
    const user = userEvent.setup()
    render(<App />)
    const s = section('missing-data')
    await user.click(within(s).getByRole('button', { name: 'Complete' }))
    for (const i of bundle.missingIndices) expect(within(s).getByTestId(`highlight-${i}`)).toBeInTheDocument()
    await user.click(within(s).getByRole('button', { name: 'Incomplete' }))
    expect(within(s).getByTestId('lost-summary')).toHaveTextContent(`${bundle.missingIndices.length} of ${bundle.observed.measurements.length} measurements are missing`)
    for (const i of bundle.missingIndices) expect(within(s).getByTestId(`gap-${i}`)).toBeInTheDocument()
  })

  it('lists every record with its status and the preprocessing results', () => {
    render(<App />)
    const table = screen.getByTestId('dataset-table')
    expect(within(table).getAllByRole('row')).toHaveLength(bundle.observed.measurements.length + 1)
    expect(within(table).getAllByText('Missing')).toHaveLength(bundle.missingIndices.length)
    const rejected = screen.getByTestId('rejected-rows')
    for (const reason of ['is not a number', 'negative latency', 'duplicate timestamp', 'no timestamp']) {
      expect(within(rejected).getByText(new RegExp(reason))).toBeInTheDocument()
    }
  })

  it('imports a CSV, reports invalid rows and updates every section', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('tab', { name: 'Import CSV' }))
    await user.upload(screen.getByTestId('csv-input'), new File(['timestamp,ping_ms\n0,10\n1,-3\n'], 'bad.csv', { type: 'text/csv' }))
    expect(await screen.findByTestId('csv-errors')).toHaveTextContent('Line 3: Latency -3 ms is negative')
    await user.upload(screen.getByTestId('csv-input'), new File(['timestamp,ping_ms\n0,20\n1,22\n2,\n3,26\n4,27\n'], 'good.csv', { type: 'text/csv' }))
    expect(await screen.findByText(/Imported: good.csv/)).toBeInTheDocument()
    expect(within(screen.getByTestId('dataset-table')).getAllByRole('row')).toHaveLength(6)
    expect(screen.getByTestId('reconstruction-status')).toHaveTextContent('1 of 1 gaps estimated')
  })
})

describe('methods, reconstruction and evaluation use the real algorithms', () => {
  it('each method panel shows the estimate computed by the algorithm', async () => {
    const user = userEvent.setup()
    render(<App />)
    const s = section('methods')
    const focus = chooseFocusGap(bundle)!
    const value = (method: 'lagrange' | 'newton' | 'spline', i = focus) => {
      const [o] = reconstruct(bundle.observed, [i], { method, nodeCount: 4 })
      if (!o.ok) throw new Error('expected an estimate')
      return o.value
    }
    expect(within(s).getByTestId('method-estimate')).toHaveTextContent(`${fmt(value('lagrange'), 2)} ms`)
    expect(within(s).getByTestId('basis-panel')).toBeInTheDocument()
    await user.click(within(s).getByRole('tab', { name: 'Newton divided differences' }))
    expect(within(s).getByTestId('divided-differences')).toBeInTheDocument()
    expect(within(s).getByTestId('method-estimate')).toHaveTextContent(`${fmt(value('newton'), 2)} ms`)
    await user.click(within(s).getByRole('tab', { name: 'Natural cubic spline' }))
    expect(within(s).getByTestId('method-estimate')).toHaveTextContent(`${fmt(value('spline'), 2)} ms`)
    const other = bundle.missingIndices.find((i) => i !== focus && reconstruct(bundle.observed, [i], { method: 'spline', nodeCount: 4 })[0].ok)!
    await user.selectOptions(within(s).getByLabelText('Missing point'), String(other))
    expect(within(s).getByTestId('method-estimate')).toHaveTextContent(`t = ${fmtSeconds(bundle.observed.measurements[other].timestamp)} s`)
    expect(within(s).getByTestId('method-estimate')).toHaveTextContent(`${fmt(value('spline', other), 2)} ms`)
  })

  it('reconstructs every gap and compares original with reconstructed', async () => {
    const user = userEvent.setup()
    render(<App />)
    const s = section('reconstruction')
    const outcomes = reconstruct(bundle.observed, bundle.missingIndices, { method: 'spline', nodeCount: 4 })
    expect(within(s).getByTestId('reconstruction-status')).toHaveTextContent(`${outcomes.length} of ${outcomes.length} gaps estimated`)
    for (const o of outcomes) {
      if (!o.ok) continue
      expect(within(s).getByTestId(`reconstructed-${o.index}`)).toBeInTheDocument()
      expect(within(s).getByTestId('estimates-table')).toHaveTextContent(`${fmt(o.value, 2)} ms`)
    }
    await user.click(within(s).getByRole('button', { name: 'Original' }))
    expect(within(s).queryByTestId(`reconstructed-${outcomes[0].index}`)).toBeNull()
    await user.click(within(s).getByRole('button', { name: 'Lagrange' }))
    await user.click(within(s).getByRole('button', { name: 'Reconstructed' }))
    const lag = reconstruct(bundle.observed, bundle.missingIndices, { method: 'lagrange', nodeCount: 4 })
    expect(within(s).getByTestId('estimates-table')).toHaveTextContent(`${fmt((lag[0] as { value: number }).value, 2)} ms`)
  })

  it('evaluation metrics equal the evaluation module and the best method is highlighted', () => {
    render(<App />)
    const plan = planExperiment(bundle, 20, 11)
    const exp = runAccuracyExperiment(plan.reference, plan.hiddenPositions, 4)
    for (const r of exp.results) {
      const card = screen.getByTestId(`metrics-${r.method}`)
      expect(card).toHaveTextContent(fmt(r.metrics!.mae, 3))
      expect(card).toHaveTextContent(fmt(r.metrics!.rmse, 3))
      expect(card).toHaveTextContent(fmt(r.metrics!.maxAbsError, 3))
      if (exp.tiedBest.includes(r.method)) expect(within(card).getByText('Lowest RMSE')).toBeInTheDocument()
      else expect(within(card).queryByText('Lowest RMSE')).toBeNull()
    }
    expect(screen.getAllByTestId('error-pair')).toHaveLength(plan.hiddenPositions.length)
    expect(screen.getByTestId('interpretation')).toHaveTextContent('does not validate any estimate')
    expect(screen.getByTestId('key-findings')).toHaveTextContent(fmt(exp.results.find((r) => r.method === exp.bestByRmse)!.metrics!.rmse, 3))
    expect(screen.getByTestId('credits')).toHaveTextContent('Numerical Methods')
  })
})
