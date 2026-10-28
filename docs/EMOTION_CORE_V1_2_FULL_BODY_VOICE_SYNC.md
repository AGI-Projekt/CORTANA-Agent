# Emotion Core v1.2.0 — Full-Body Animation & Voice Synchronization

## Scope

v1.2 extends the v1.1 allowlisted emotion-to-animation engine with procedural upper-body gestures and a bounded voice-activity input. This remains a presentation layer: it does not detect a person's true emotional state, infer intent, or change agent permissions.

## Full-body animation

- Procedural shoulder/upper-arm, forearm, palm, and simplified finger meshes are parented to the avatar root.
- Eight fixed gesture profiles map the existing expression IDs to bounded arm lift, arm openness, wrist turn, and gesture pulse.
- Gesture transitions use frame-rate-independent smoothing; voice energy adds only a restrained motion envelope.
- No external rig, downloaded asset, or skeletal animation dependency is required.

## Voice synchronization

- `setVoiceActivity(level, speaking)` clamps energy to [0, 1] and accepts an explicit speaking flag.
- The WebRTC path reuses the local analyser's smoothed mouth-energy value, sharing the existing AudioContext playback path.
- Browser SpeechSynthesis emits `cortana:voice-state` events at start, text boundaries, end, and error; the avatar uses a conservative boundary-driven activity estimate for gestures.
- Existing `audio-clock.js` playout anchors remain the timing bridge for future timestamped visemes. This release does not fabricate phoneme timestamps and does not claim phoneme-accurate lip sync.

## Validation

Run `node --test tests/js/*.test.cjs` and `python -m pytest`. The emotion animation tests cover version, profile allowlists, interpolation, unknown labels, delta bounds, reset, gesture profile parity, and voice-energy clamping.
