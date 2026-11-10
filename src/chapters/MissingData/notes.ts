import type { PresenterNotes } from '../../types/presentation'

export const missingDataNotes: PresenterNotes = {
  explain: [
    'The timeline is a short example series: one probe per second, values in milliseconds.',
    'Two timestamps (t = 4 s and t = 6 s) have no record. The time exists; the value does not.',
    'A missing record is not automatically packet loss. It can be a failed probe, a reply after the timeout, or a collector/storage error.',
    'Why reconstruct: averages and percentiles become biased, charts break, rate-of-change calculations fail, and many tools expect evenly spaced data.',
  ],
  terms: [
    { term: 'Missing record', meaning: 'a timestamp in the expected series with no stored value.' },
    { term: 'Packet loss', meaning: 'a packet that never reaches its destination; only one of several causes of a missing record.' },
    { term: 'Time series', meaning: 'measurements ordered by time.' },
  ],
  narration:
    'Here are seven seconds of pings. Watch as they appear. Two of them never arrive in our records. It is tempting to call that packet loss, but the gap only tells us that nothing was written. The probe may have failed, the reply may have been too slow, or the logger may have crashed. Either way, the series now has holes, and the analysis downstream needs them filled responsibly.',
  questions: [
    { q: 'Why not fill gaps with the mean?', a: 'The mean ignores the local trend; at t = 4 s the neighbours are 31 and 42 ms, far from the series mean. Interpolation uses the neighbours.' },
    { q: 'Could a gap mean the network was very slow?', a: 'Yes — a timeout gap may hide a very large latency. That is a real limitation: interpolation assumes the hidden value follows the surrounding trend. We state this in the conclusion.' },
    { q: 'Is it valid to reconstruct at all?', a: 'Only between known values, only when the series is reasonably smooth, and the result should be flagged as reconstructed, never presented as measured.' },
  ],
}
