# Emotion Core v1.5.0 — Real-Time Viseme Provider & Lip Sync Calibration

## Scope

v1.5 adds a provider adapter contract and a calibration layer over the v1.4 AudioContext-to-performance-clock runtime. It does not bundle a phoneme recognizer, forced aligner, speech model, or proprietary provider SDK. A real acoustic aligner must supply timestamped viseme events.

## Provider contract

The browser exposes `window.CortanaVisemeProvider`:

- `connect(adapter, playbackAnchor)`: attach an adapter implementing `subscribe(push)`; returns a disposer function or object with `unsubscribe()`.
- `push(events)`: accept a batch of 1–128 events shaped as `{ audioTimeSeconds, durationMs, viseme, character? }`.
- `updateAnchor(anchor)`: update the AudioContext/performance clock mapping during playout.
- `disconnect()`, `getState()`, and `getStats()`.

Only allowlisted visemes are accepted. Event durations, timestamps, batch sizes, future horizon, late-event window, and pending buffer are bounded. Very late or excessively future events are dropped; malformed events and buffer overflow are rejected. Accepted batches are emitted as `cortana:audio-aligned-visemes` and use the v1.4 scheduler.

An application-specific adapter can be attached by dispatching `cortana:viseme-provider-connect` with `{ adapter }` after an audio playout anchor is available. Provider lifecycle events are published as `cortana:viseme-provider-state`; ingestion metrics use `cortana:viseme-provider-stats`.

## Calibration

The browser exposes `window.CortanaLipSyncCalibration`:

- `addSample({ audioTimeSeconds, expectedPerformanceTimeMs, anchor })`
- `calibrate(samples)`
- `getOffsetMs()`, `getState()`, and `reset()`

At least three paired samples are required. The estimator uses the median residual between expected performance time and the mapped AudioContext time, retaining at most 31 samples and clamping the applied offset to ±250 ms. The calibrated offset adjusts the playback anchor used for timestamped viseme scheduling. This is a clock/latency calibration; it does not derive phoneme boundaries from raw audio.

## Accuracy and limitations

The provider bridge is real-time capable, but alignment accuracy depends on the upstream provider's timestamps and the browser's output clock. No built-in acoustic aligner is included in this release. If no provider is connected, the existing grapheme-based mouth animation remains an explicitly approximate fallback.

## Tests

Run `node --test tests/js/*.test.cjs` and `python -m pytest`. Tests cover provider lifecycle, validation, batching, buffer bounds, late/future filtering, calibration sample minimums, median offset, clamping, reset, and static integration.
