import type { PresenterNotes } from '../../types/presentation'

export const missingDataNotes: PresenterNotes = {
  explain: [
    'The series builds as you scroll: one probe per second from the active dataset.',
    'Then some measurements fall away. The time slots remain (crimson rings); the values are gone.',
    'With synthetic data the vanished values were generated, so we can later check our estimates against them. In a real monitor they would never be seen.',
    'The three facts are computed live: coverage and longest unbroken run, broken rate-of-change steps, and the recorded average against the true one.',
    'A missing record is not automatically packet loss: failed probes, late replies and collector errors all leave the same gap.',
  ],
  terms: [
    { term: 'Missing record', meaning: 'a timestamp in the expected series with no stored value.' },
    { term: 'Packet loss', meaning: 'a packet that never reaches its destination; one of several causes of a missing record.' },
    { term: 'Coverage', meaning: 'share of expected intervals that hold a value.' },
  ],
  narration:
    'Here is a latency series as it is recorded, one probe per second. Now watch some of it disappear. Those slots are still on the time axis, but nothing was stored. The gaps change real answers: the average shifts, every step next to a gap has no rate of change, and tools that expect one value per interval fail. And the cause is not always packet loss: the probe may have failed, the reply may have been late, or the logger may have dropped it.',
  questions: [
    { q: 'Why not fill gaps with the mean?', a: 'The mean ignores the local trend; interpolation uses the neighbours of each gap.' },
    { q: 'Could a gap hide a very slow reply?', a: 'Yes. A timeout gap may hide a large latency that no interpolant can recover. That limitation is stated in the conclusion.' },
    { q: 'Is it valid to reconstruct at all?', a: 'Between known values, for reasonably smooth series, and only if estimates are marked as estimates, never presented as measurements.' },
  ],
}
