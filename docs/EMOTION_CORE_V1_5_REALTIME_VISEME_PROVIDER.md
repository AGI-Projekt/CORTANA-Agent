# Emotion Core v1.5.0 — Real-Time Viseme Provider & Lip Sync Calibration

## Scope

v1.5 builds on the response-scoped external viseme provider already present in the application and the v1.4 AudioContext-to-performance-clock scheduler. It adds robust latency/clock-offset calibration. It does not bundle a phoneme recognizer or acoustic aligner; the upstream provider must supply genuine timestamped visemes.

## Provider boundary

The existing `CortanaVisemeProvider` validates `cortana.viseme.timeline` events, response IDs, timestamps, duration, allowed viseme labels, and event-count limits before forwarding them to `CortanaVisemeScheduler.playAudioAlignedTimeline`. Stale response events are rejected.

## Calibration API

The browser exposes `window.CortanaLipSyncCalibration`:

- `addSample({ audioTimeSeconds, expectedPerformanceTimeMs, anchor })`
- `calibrate(samples)`
- `getOffsetMs()`, `getState()`, and `reset()`

At least three paired samples are required. The estimator uses the median residual between the expected performance timestamp and the timestamp mapped through the audio playout anchor. It retains at most 31 samples and clamps correction to ±250 ms. Calibration is applied to the monotonic playback anchor before the viseme timeline is scheduled.

## Accuracy boundary

Calibration corrects a measured clock/latency offset; it does not identify phoneme boundaries. Lip-sync accuracy still depends on the upstream aligner's timestamp quality and the browser output clock. When no aligned provider event is available, transcript/grapheme mouth motion remains an explicitly approximate fallback.

## Validation

Run `node --test tests/js/*.test.cjs` and `python -m pytest`. The calibration tests cover minimum sample count, median estimation, clamping, reset, and invalid input. The integration test verifies the calibration module is loaded and applied by the audio-aligned scheduler.
