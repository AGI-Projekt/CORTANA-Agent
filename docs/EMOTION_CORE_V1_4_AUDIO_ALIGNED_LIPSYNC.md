# Emotion Core v1.4.0 — Audio-Aligned Lip Sync Runtime

## Purpose

v1.4 provides a runtime path for externally supplied viseme events timestamped against the same AudioContext that produces audio. It maps each provider's `audioTimeSeconds` to the monotonic browser playback clock using an explicit `CortanaAudioClock` anchor, then schedules the allowed viseme cue on the avatar.

## Event contract

Dispatch `cortana:audio-aligned-visemes` with either:

- `{ audioEvents: [{ audioTimeSeconds, durationMs, viseme, character? }], anchor? }` for timestamps measured in AudioContext seconds; or
- `{ events: [{ atMs, durationMs, viseme, character? }], anchorTimeMs? }` for a source that already uses the `performance.now()` clock domain.

The audio-aligned path requires a captured anchor with `anchorTimeMs` and `contextTimeSeconds`. The viseme scheduler validates event count, viseme allowlist, timestamps, and durations before replacing the current animation. The runtime emits `cortana:viseme-timeline-result` with an accepted/rejected outcome.

## API

- `CortanaVisemeScheduler.playAudioAlignedTimeline(events, anchor)`
- `CortanaAudioClock.scheduleAudioAlignedTimeline(scheduler, events, anchor?)`
- `CortanaAudioClock.markOutputStart(audioContext)`

The explicit anchor is critical: it maps AudioContext time to the monotonic timeline clock. Without a provider that emits real audio-aligned phoneme/viseme timestamps, the existing text-to-viseme path remains approximate. This runtime does not infer phoneme boundaries from transcript text or audio energy.

## Validation

Run `node --test tests/js/*.test.cjs` and `python -m pytest`. Tests cover AudioContext timestamp mapping, invalid/missing anchors, event limits, viseme validation, cancellation, and clock-bridge behavior.
