# Dataset Documentation

## Synthetic generator — `src/simulation/datasetGenerator/generateDataset.ts`

| Setting | Default | Allowed |
| --- | --- | --- |
| Samples | 48 | 12–240 |
| Minimum latency | 18 ms | ≥ 1 ms |
| Maximum latency | 72 ms | ≤ 1000 ms, at least 5 ms above the minimum |
| Generator seed | 2026 | non-negative integer |
| Irregular probe times | off | on: interior times jittered by up to ±0.35 s |

Model, for probe $i$ at time $t$ (seconds, nominally 1 s apart):

```
shape = 0.38
      + 0.16 · sin(2πt / P_slow + φ1)      slow load cycle, P_slow ≈ 0.8–1.4 × n
      + 0.05 · sin(2πt / P_fast + φ2)      ripple, P_fast 6–12 s
      + Σ h_e · exp(−((t − c_e)/w_e)²)     1–3 congestion episodes
      + 0.045 · AR(1) jitter               j ← 0.65 j + 0.35 N(0,1)
RTT  = clamp(min + (max − min) · shape, min, max), rounded to 0.1 ms
```

All randomness comes from Mulberry32 seeded with the generator seed (Box–Muller for normals), so
the same settings always produce the same series — essential for a reproducible viva.

## Missing-data masks — `src/simulation/missingData/missingData.ts`

| Setting | Default | Notes |
| --- | --- | --- |
| Missing share | 18 % | 0–50 %, rounded to whole records |
| Pattern | random | random positions, or consecutive bursts of 2–4 records |
| Mask seed | 7 | independent of the generator seed |

Rules: the first and last record are never hidden (no extrapolation); at least 5 records stay
known; bursts are separated by at least one observed record.

Default dataset: 48 records, 9 missing (indices 1, 4, 17, 22, 25, 26, 30, 34, 45), observed range
29.3–55.2 ms.

## Separation of data

`applyMask` produces two frozen structures:

* **ObservedDataset** — every timestamp; `observedPingMs` is `null` for hidden rows. The only
  input accepted by the reconstruction pipeline.
* **GroundTruth** — `Map<index, value>` of every known true value. Read only by the evaluation.

## CSV import — `src/data/csv/parseLatencyCsv.ts`

Format:

```csv
timestamp,ping_ms
0,24.1
1,27.6
2,31.0
3,
4,41.8
5,timeout
```

* Header must be exactly `timestamp,ping_ms` (case-insensitive, surrounding spaces ignored).
* Timestamps: numbers in seconds, strictly increasing. Epoch seconds are fine; they are shifted
  so the first row is 0.
* A latency cell that is empty, `NA`, `N/A`, `null`, `NaN`, `-` or `timeout` is a missing
  measurement (genuinely unknown, no ground truth).

| Problem | Reported as |
| --- | --- |
| Empty file / header only | `The file is empty.` / `…no data rows.` |
| Wrong header | `Header must be exactly "timestamp,ping_ms"…` |
| Wrong number of cells, quote errors | `Line n: Expected 2 cells…` / `Malformed CSV: …` |
| Missing timestamp | `Line n: Timestamp is missing.` |
| Non-numeric value | `Line n: Latency "abc" is not a number…` |
| Negative latency | `Line n: Latency −4 ms is negative…` |
| Duplicate timestamp | `Line n: Timestamp t duplicates line m.` |
| Out of order | `Line n: Timestamp t is earlier than …` |
| Fewer than 4 known values | `Only k rows have a latency value; at least 4 are needed.` |
| Missing first/last value | warning: those records cannot be interpolated |

Invalid files are rejected as a whole (the previous dataset stays active) with up to 25 issues
listed. Files over 5 MB are refused.

For CSV data, scene 6 cannot score genuinely missing rows; it holds out a seeded share
(default 20 %) of known interior rows instead.

## Packet simulation — `src/simulation/networkSimulation/simulateProbe.ts`

Four hops (client→router→server→router→client). Each hop delay = propagation (0.9 ms local,
11.5 ms wide-area) + transmission (0.12 / 0.05 ms) + exponential queuing (mean 0.8 / 3.2 ms).
Server processing 0.2–0.6 ms. Timeout 1000 ms.

The opening scene uses a network profile: queuing means are multiplied by a slowly varying load
(1 + 0.9·(0.5 + 0.5·sin(n/13)) plus occasional bursts), and each reply is lost with probability
0.06. A lost reply is recorded as a timeout, with no RTT. Seed 2026, so the story opens the same
way every time.

## Preparation pipeline — `src/data/preparation/preparationPipeline.ts`

Scene 3 animates this function's real output. `buildRawStream` turns the observed dataset back
into text records in network arrival order (mostly in time order, with local reordering) and
injects four labelled faults: a non-numeric value, a negative latency, a later duplicate of an
existing timestamp, and a row with no timestamp. `runPreparationPipeline` then:

1. **Validates** each row with the CSV importer's cell rules. Faulty rows are set aside with a
   reason; for duplicates the first arrival is kept.
2. **Sorts** the accepted rows by timestamp.
3. **Identifies missing** values: empty, NA or timeout cells stay in the series as empty slots.

A unit test checks that the result equals the observed dataset exactly (timestamps, values and
missing records), so the animation shows the true path of the data into the algorithms.
