import { describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { DatasetProvider } from '../state/DatasetContext'
import { createSyntheticBundle } from '../data/datasets'
import { reconstruct } from '../reconstruction/reconstruct'
import { fmt } from '../utils/format'
import { computeWorkedExample } from './NumericalMethods/workedExample'
import { planExperiment, runAccuracyExperiment } from '../evaluation/comparison/compareMethods'
import DatasetPreparation from './DatasetPreparation/DatasetPreparation'
import NumericalMethods from './NumericalMethods/NumericalMethods'
import Reconstruction from './Reconstruction/Reconstruction'
import AccuracyEvaluation from './AccuracyEvaluation/AccuracyEvaluation'
import NetworkTransmission from './NetworkTransmission/NetworkTransmission'
import Conclusion from './Conclusion/Conclusion'

const noop = () => {}
const withData = (ui: ReactElement) => render(<DatasetProvider>{ui}</DatasetProvider>)

describe('chapter 2: packet journey', () => {
  it('records an RTT for a ping and none for a timeout (reduced motion completes instantly)', async () => {
    const original = window.matchMedia
    window.matchMedia = ((q: string) => ({ ...original(q), matches: q.includes('reduce') })) as typeof window.matchMedia
    const user = userEvent.setup()
    render(<NetworkTransmission step={0} onNextChapter={noop} />)
    await user.click(screen.getByRole('button', { name: 'Send ping' }))
    expect(await screen.findByTestId('hop-table')).toBeInTheDocument()
    expect(screen.getByText(/Reply received after \d+\.\d\d ms/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Send ping that times out' }))
    expect(await screen.findByText('Timed out: no value recorded')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Probe history' })).getByText('no reply')).toBeInTheDocument()
    window.matchMedia = original
  })
})

describe('chapter 4: dataset preparation', () => {
  it('regenerates the dataset from the form and validates input', async () => {
    const user = userEvent.setup()
    withData(<DatasetPreparation step={0} onNextChapter={noop} />)
    const samples = screen.getByLabelText(/Samples/)
    await user.clear(samples)
    await user.type(samples, '60')
    await user.click(screen.getByRole('button', { name: 'Generate dataset' }))
    expect(within(screen.getByTestId('dataset-stats')).getByText('60')).toBeInTheDocument()

    await user.clear(samples)
    await user.type(samples, '3')
    await user.click(screen.getByRole('button', { name: 'Generate dataset' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/Sample count must be/)
  })

  it('imports a CSV file and reports invalid rows with line numbers', async () => {
    const user = userEvent.setup()
    withData(<DatasetPreparation step={0} onNextChapter={noop} />)
    await user.click(screen.getByRole('tab', { name: 'Import CSV' }))

    const bad = new File(['timestamp,ping_ms\n0,10\n1,-3\n2,abc\n'], 'bad.csv', { type: 'text/csv' })
    await user.upload(screen.getByTestId('csv-input'), bad)
    const errors = await screen.findByTestId('csv-errors')
    expect(errors).toHaveTextContent('Line 3: Latency -3 ms is negative')
    expect(errors).toHaveTextContent('Line 4: Latency "abc" is not a number')
    expect(screen.getByTestId('dataset-label')).toHaveTextContent('Synthetic')

    const good = new File(['timestamp,ping_ms\n0,20\n1,22\n2,\n3,26\n4,27\n'], 'good.csv', { type: 'text/csv' })
    await user.upload(screen.getByTestId('csv-input'), good)
    await waitFor(() => expect(screen.getByTestId('dataset-label')).toHaveTextContent('Imported from good.csv'))
    expect(screen.getByText(/Loaded good.csv: 5 rows, 1 without a value/)).toBeInTheDocument()
  })
})

describe('chapter 5: worked example', () => {
  it('shows the estimate produced by the algorithms, and Newton matches Lagrange', async () => {
    const user = userEvent.setup()
    const ex = computeWorkedExample()
    const { rerender } = render(<NumericalMethods step={3} onNextChapter={noop} />)
    expect(screen.getByTestId('worked-estimate')).toHaveTextContent(fmt(ex.lagrange.value, 2))
    await user.click(screen.getByRole('tab', { name: 'Newton' }))
    expect(screen.getByTestId('divided-differences')).toBeInTheDocument()
    expect(screen.getByTestId('worked-estimate')).toHaveTextContent(fmt(ex.newton.value, 2))
    await user.click(screen.getByRole('tab', { name: 'Cubic spline' }))
    expect(screen.getByTestId('worked-estimate')).toHaveTextContent(fmt(ex.spline.value, 2))
    rerender(<NumericalMethods step={0} onNextChapter={noop} />)
    expect(screen.getByTestId('worked-estimate').closest('[aria-hidden]')).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('chapter 6: reconstruction', () => {
  it('reconstructs the selected record with the chosen method and shows the steps', async () => {
    const user = userEvent.setup()
    const bundle = createSyntheticBundle()
    withData(<Reconstruction step={0} onNextChapter={noop} />)
    await user.click(screen.getByRole('button', { name: 'Lagrange' }))
    await user.click(screen.getByRole('button', { name: 'Reconstruct' }))
    const [expected] = reconstruct(bundle.observed, [bundle.missingIndices[0]], { method: 'lagrange', nodeCount: 4 })
    if (!expected.ok) throw new Error('expected success')
    expect(screen.getByTestId('reconstructed-value')).toHaveTextContent(fmt(expected.value, 2))
    expect(within(screen.getByTestId('intermediate-steps')).getByText(/P\(x\) = Σ/)).toBeInTheDocument()
    expect(screen.getByTestId(`reconstructed-${bundle.missingIndices[0]}`)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reconstruct all' }))
    expect(screen.getByRole('status')).toHaveTextContent(`${bundle.missingIndices.length} of ${bundle.missingIndices.length} missing records reconstructed`)
  })
})

describe('chapter 7: accuracy', () => {
  it('shows metrics computed from the live experiment', () => {
    const bundle = createSyntheticBundle()
    const plan = planExperiment(bundle, 20, 11)
    const exp = runAccuracyExperiment(plan.reference, plan.hiddenPositions, 4)
    withData(<AccuracyEvaluation step={3} onNextChapter={noop} />)
    for (const r of exp.results) {
      const row = screen.getByTestId(`metrics-${r.method}`)
      expect(row).toHaveTextContent(fmt(r.metrics!.mae, 3))
      expect(row).toHaveTextContent(fmt(r.metrics!.rmse, 3))
      expect(row).toHaveTextContent(fmt(r.metrics!.maxAbsError, 3))
    }
    // Lagrange and Newton are reported as a tie, not as one beating the other
    expect(exp.tiedBest.includes('lagrange') === exp.tiedBest.includes('newton')).toBe(true)
    expect(screen.getByTestId('interpretation')).toHaveTextContent(/Lowest RMSE on this dataset/)
    expect(screen.getByText(/does not validate any estimate of a value that was never measured/)).toBeInTheDocument()
  })
})

describe('chapter 8: conclusion', () => {
  it('summarises live results and shows credits on the last build', () => {
    const { rerender } = withData(<Conclusion step={1} onNextChapter={noop} />)
    expect(screen.getByTestId('conclusion-metrics')).toHaveTextContent('ms')
    rerender(
      <DatasetProvider>
        <Conclusion step={3} onNextChapter={noop} />
      </DatasetProvider>,
    )
    expect(screen.getByTestId('credits')).toHaveTextContent('Numerical Methods')
  })
})
