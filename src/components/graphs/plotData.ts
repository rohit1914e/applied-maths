import type { PlotMeasurement } from './LatencyPlot'
import type { Measurement } from '../../types/measurement'

/** Plot rows from pipeline measurements: reconstructed rows plot their estimate. */
export function toPlotData(measurements: readonly Measurement[]): PlotMeasurement[] {
  return measurements.map((m) => ({
    index: m.index,
    x: m.timestamp,
    y: m.status === 'reconstructed' ? m.reconstructedPingMs : m.observedPingMs,
    status: m.status,
  }))
}
