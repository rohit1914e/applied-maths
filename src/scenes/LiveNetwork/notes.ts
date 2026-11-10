import type { PresenterNotes } from '../../types/presentation'

export const liveNetworkNotes: PresenterNotes = {
  explain: [
    'The opening is live: a seeded simulation sends one probe per second from client to server and back.',
    'Latency is the time a message needs to cross the network; ping measures it as round-trip time (RTT) in milliseconds.',
    'Readouts (latest RTT, average, jitter, timeouts) and the trace are computed from the simulated probes on screen.',
    'Step 2: each hop adds propagation, transmission and queuing delay; the table shows the latest probe and sums to its RTT.',
    'Step 3: about 6 % of replies are lost. A reply that never arrives within 1000 ms leaves an empty slot (crimson ring).',
    'The network load rises and falls slowly, so the trace waves like a real link under changing traffic.',
  ],
  terms: [
    { term: 'Latency', meaning: 'delay between sending data and it arriving; reported here as RTT.' },
    { term: 'RTT', meaning: 'round-trip time: request out plus reply back, including server processing.' },
    { term: 'ICMP echo', meaning: 'the request/reply message pair that ping uses.' },
    { term: 'Jitter', meaning: 'variation of latency between consecutive probes (mean absolute difference here).' },
    { term: 'Timeout', meaning: 'the longest the sender waits for a reply before recording nothing.' },
  ],
  narration:
    'What you see is a small network running live. Every second my laptop sends a probe through the router to a server and waits for the echo. The time that takes is the round-trip time, and the trace at the bottom is the record a monitoring tool keeps. Watch the crimson marks: some replies never come back, and the record simply has nothing there. That is the problem this project solves.',
  formula: 'RTT = t_reply − t_request = Σ over hops (propagation + transmission + queuing) + server processing.',
  questions: [
    { q: 'Are these real pings?', a: 'No. It is a seeded simulation with realistic delay components so the demonstration is repeatable. Real ICMP needs privileged sockets and is a future extension.' },
    { q: 'Is latency the same as bandwidth?', a: 'No. Bandwidth is data per second; latency is how long one packet takes. A link can be good at one and poor at the other.' },
    { q: 'Why model queuing as exponential?', a: 'Buffer waits are mostly short with occasional long ones; the exponential distribution is the standard first model (as in M/M/1 queues).' },
    { q: 'Why RTT rather than one-way delay?', a: 'RTT needs only the sender’s clock; one-way delay needs synchronised clocks at both ends.' },
  ],
}
