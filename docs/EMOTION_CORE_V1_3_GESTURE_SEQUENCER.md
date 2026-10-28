# Emotion Core v1.3.0 — Gesture Sequencer & Timestamped Viseme Synchronization

## Gesture sequencer

The browser now exposes `window.CortanaGestureSequencer` with named `speaking`, `listening`, and `emphasis` sequences plus a validated `playTimeline(events, anchorTimeMs)` API. Timelines use the same monotonic `performance.now()` clock domain as audio playout anchors. Sequence events emit `cortana:gesture-frame`; the procedural avatar consumes the bounded arm-lift, arm-open, and wrist-turn pose values.

The sequencer supports interruption, cancellation, future anchors, a maximum of 96 events, offsets up to 30 seconds, durations up to 8 seconds, and an allowlist of pose names. Voice-state events start or cancel the speaking sequence. Gesture cues are presentation-only and do not infer a person's emotions.

## Timestamped visemes

The app listens for `cortana:audio-aligned-visemes` events carrying `{ events, anchorTimeMs? }`. It schedules the supplied event list through `CortanaVisemeScheduler.playTimeline`; when no explicit anchor is supplied, it uses the latest `CortanaAudioClock` output anchor if available. Results are announced with `cortana:viseme-timeline-result` so callers can observe validation success or rejection.

Each event must provide an allowlisted viseme and bounded `atMs` / `durationMs` offsets. Invalid timelines are rejected before they interrupt a currently running schedule.

## Accuracy boundary

This release adds the runtime integration contract, scheduler, and timestamped gesture execution. It does not itself create acoustic phoneme/viseme timestamps. The current transcript-to-viseme path remains approximate unless a voice provider supplies genuine audio-aligned events. A playout clock anchor aligns time domains; it does not reveal phoneme boundaries by itself.

## Tests

Run `node --test tests/js/*.test.cjs` and `python -m pytest`. Deterministic gesture tests cover future anchors, event ordering, cancellation, invalid data, voice-state activation, and bounded event counts.
