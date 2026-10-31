# Emotion Core v1.8.0 — Context-Aware Multimodal Emotion & Prosody Synchronization

## Scope

v1.8 adds a browser-side fusion and scheduling boundary for timestamped contextual emotion scores and voice-prosody features. It connects these signals to the existing avatar emotion transition event and the audio playout clock.

## API

`window.CortanaEmotionProsodySync` exposes:

- `analyze({ responseId, audioTimeSeconds, emotionScores, prosody, contextWeight?, smoothing? })`: validates and fuses an emotion-score vector with supplied prosody features.
- `schedule(events, anchor, expectedResponseId)`: maps audio-clock timestamps to the monotonic performance clock and emits synchronized `cortana:emotion-transition` and `cortana:multimodal-emotion` events.
- `cancel()` and `reset()`: cancel pending transitions and clear response-scoped smoothing state.

Supported prosody fields are pitchHz (40–1200), energy (0–1), speechRate (0–8), pauseMs (0–10000), and pitchVariation (0–1). Emotion labels are restricted to the eight existing animation profiles. Timeline size, duration, timestamps, confidence values, and response IDs are bounded and validated.

## Fusion model

Context emotion scores are combined with conservative prosody-derived biases. A bounded exponential smoothing step reduces frame-to-frame switching. A new response ID resets smoothing state. The output confidence and per-class scores remain explicit; the avatar receives the selected allowlisted emotion through its existing `cortana:emotion-transition` listener.

## Synchronization

The scheduler requires a valid audio playout anchor and uses `CortanaAudioClock.performanceTimeForContextTime()` to map each event's AudioContext timestamp onto the monotonic performance clock. Cancellation invalidates outstanding callbacks so events from an interrupted response cannot update the avatar.

## Accuracy and privacy boundaries

- This module does not analyze raw audio, access the microphone, or claim to infer emotion directly from voice.
- Prosody features and contextual emotion scores must be supplied by an upstream, explicitly enabled component.
- Prosody heuristics are weak contextual signals, not psychological facts or diagnoses.
- No audio, transcript, or learned profile is persisted by this module.
- Unknown labels and malformed, stale, oversized, or out-of-range inputs are rejected.

## Tests

Node tests cover fusion, smoothing, response isolation, timestamp mapping, cancellation, reset, and input validation.
