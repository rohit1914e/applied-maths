import type { PresenterNotes } from '../../types/presentation'

export const introductionNotes: PresenterNotes = {
  explain: [
    'Latency is the time a message needs to cross a network; we measure it as round-trip time (RTT) in milliseconds.',
    'Ping sends an ICMP Echo Request and times the Echo Reply. One ping gives one RTT sample.',
    'Monitoring tools ping at fixed intervals to build a time series: a measurement every second, minute, etc.',
    'Real series have holes. The project reconstructs them with numerical interpolation and measures how accurate that is.',
  ],
  terms: [
    { term: 'Latency', meaning: 'delay between sending data and it arriving; often reported as RTT.' },
    { term: 'RTT', meaning: 'round-trip time: request out plus reply back, including processing at the far end.' },
    { term: 'ICMP', meaning: 'Internet Control Message Protocol; ping uses its Echo Request/Reply messages.' },
    { term: 'Interpolation', meaning: 'estimating a value between known data points using a function that passes through them.' },
  ],
  narration:
    'Every time you load a page or join a call, packets travel to a server and back. The time that takes is latency. We monitor it by pinging regularly, but those records are not always complete. This project asks: when a measurement is missing, how well can numerical interpolation recover it?',
  questions: [
    { q: 'Is latency the same as bandwidth?', a: 'No. Bandwidth is how much data per second a link carries; latency is how long one piece of data takes to arrive. A link can be fast in one and poor in the other.' },
    { q: 'Why interpolation rather than just ignoring missing points?', a: 'Many analyses need a regular series (averages per interval, plotting, alert thresholds, spectral analysis). Ignoring gaps biases the statistics or breaks those tools.' },
    { q: 'Does this predict future latency?', a: 'No. Interpolation estimates values between known measurements. Predicting beyond the data is extrapolation or forecasting, which this project deliberately rejects.' },
  ],
}
