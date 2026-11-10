import type { PresenterNotes } from '../../types/presentation'

export const transmissionNotes: PresenterNotes = {
  explain: [
    'Press "Send ping": the request travels client → router → server, the server replies, the reply returns.',
    'Each hop adds propagation delay (distance ÷ signal speed), transmission delay (packet size ÷ link rate) and queuing delay (waiting in router buffers).',
    'RTT = time the reply arrives − time the request left. The hop table shows the simulated breakdown that adds up to the RTT.',
    'Send several pings: queuing is random, so RTT varies from probe to probe. That variation is jitter.',
    'Press "Send ping that times out": no reply before the 1000 ms timeout, so no RTT is recorded. This creates a missing record.',
  ],
  terms: [
    { term: 'Propagation delay', meaning: 'signal travel time over the physical medium; fixed for a given path length.' },
    { term: 'Queuing delay', meaning: 'time spent waiting in a router buffer; varies with load and causes most jitter.' },
    { term: 'Timeout', meaning: 'the longest the sender waits for a reply before declaring the probe unanswered.' },
    { term: 'Jitter', meaning: 'variation of latency between consecutive packets.' },
  ],
  narration:
    'Here is one probe. The request leaves my laptop, crosses the local router and the wider network, reaches the server, and comes back. The round-trip time is simply the difference between the two clocks at the sender. If the reply never comes in time, the tool writes nothing at all — that is where our missing measurements begin.',
  formula: 'RTT = Σ (propagation + transmission + queuing) over every hop, there and back, + server processing time.',
  questions: [
    { q: 'Are these real network measurements?', a: 'No. The packet journey is a seeded simulation with realistic delay components, so the demonstration is repeatable. Real ICMP needs privileged sockets and is listed as a future extension.' },
    { q: 'Why is RTT measured instead of one-way delay?', a: 'RTT needs only the sender’s clock. One-way delay needs two synchronised clocks, which is hard to guarantee.' },
    { q: 'Why model queuing as exponential?', a: 'Buffer waits are mostly short with occasional long ones; the exponential distribution is the standard first model for that (as in M/M/1 queues).' },
  ],
}
