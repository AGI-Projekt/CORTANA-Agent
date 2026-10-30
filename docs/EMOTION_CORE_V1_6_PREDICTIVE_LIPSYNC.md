# Emotion Core v1.6.0 — Predictive Lip Sync & Adaptive Latency Compensation

## Overview

v1.6 extends v1.5 provider validation and clock calibration with a bounded adaptive controller. It learns how late scheduled viseme boundaries are actually emitted by the browser timer/render loop, then shifts future audio-aligned viseme anchors to compensate.

## Runtime

`window.CortanaPredictiveLipSync` exposes:

- `observe({ scheduledTimeMs, actualTimeMs })`: ingest measured scheduler lateness.
- `adjustAnchor(anchor)`: return a playback anchor corrected by the learned latency estimate.
- `predictViseme(events, anchor, nowMs)`: inspect the supplied timeline at the adaptive lookahead horizon.
- `getState()`, `getLookaheadMs()`, and `reset()`.

The estimator uses an EWMA with alpha 0.2, retains at most 31 timing residuals for bounded diagnostics, clamps compensation to ±120 ms, and adapts lookahead between 20 and 120 ms based on observed jitter. The viseme scheduler automatically feeds each executed timeline boundary's scheduled and actual performance timestamps into the estimator.

## Accuracy and safety boundaries

Prediction selects only from already supplied viseme events. It does not generate phonemes, infer mouth shapes from text, or predict speech content. When the external aligned provider is absent, transcript/grapheme fallback remains approximate. The estimator is resettable and all timing corrections are bounded to prevent runaway drift.

## Validation

Node tests cover latency learning, anchor compensation, adaptive lookahead, supplied-event prediction, invalid inputs, reset, and hard bounds. Python integration assertions verify the controller is loaded and connected to the scheduler.
