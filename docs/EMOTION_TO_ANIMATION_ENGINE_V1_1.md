# Emotion Core v1.1 — Emotion-to-Animation Engine

## Goal

Convert the existing allowlisted Emotion Core expression ID into a smooth, temporary
avatar animation state. This is a presentation engine, not an emotion detector. It does
not infer feelings, persist a user profile, or change tool permissions.

## Runtime flow

1. The existing opt-in/confidence gate selects one of the eight expression IDs.
2. The browser validates the ID against the fixed profile allowlist; unknown values map
   to `calm`.
3. `CortanaEmotionAnimation` interpolates facial and body parameters using an
   exponential, frame-rate-independent easing curve.
4. The Three.js render loop applies interpolated parameters to the face, body sway,
   head pose, hologram lights, and idle breathing.
5. Existing viseme events continue to control the mouth while speaking; facial emotion
   presets remain the fallback when there is no active viseme.
6. Turning emotion hints off or encountering an error returns the visual state to calm.

## Parameters

Every profile has bounded parameters for eye width/height, mouth shape/position, head
pitch/tilt, body sway, breathing amplitude, hologram color, idle light intensity, and
blink interval. The transition duration defaults to 420 ms and is clamped to a safe
range of 80–2500 ms. Delta time is bounded to avoid large jumps after a suspended tab.

## Verification

Run the JavaScript suite with `node --test tests/js/*.test.cjs` and the full project
suite with `python -m pytest`. Tests cover the allowlist, interpolation, target idempotence,
unknown labels, bounded delta time, and calm reset.
