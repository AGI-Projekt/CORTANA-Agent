# Lilith Cortana Nebiru — Emotion Visual Profiles v1.1

## Scope

Emotion Core exposes eight allowlisted avatar expressions: **calm (spokój), joy
(radość), sadness (smutek), anger (złość), fear (strach), surprise (zaskoczenie),
disgust (odraza), and determination (determinacja)**.

Version 1.1 adds the Emotion-to-Animation Engine. It interpolates the current profile
over time instead of snapping directly to new facial parameters. The procedural Three.js
avatar animates eye openness, mouth shape, head pitch/tilt, subtle upper-body sway,
breathing, and hologram accent lighting. Existing viseme events retain control of the
mouth during speech; the emotional mouth shape is used when there is no active speech
viseme.

The labels describe a presentation animation, not a verified emotional state of the user
and not a claim that the AI has subjective feelings. The concept art is not a rigged
motion-capture asset.

## Runtime flow

1. Emotion analysis remains opt-in on the Realtime transcript path.
2. The provider's estimate must pass the existing `may_adjust_tone` confidence gate.
3. The server maps the allowlisted category to a stable expression ID.
4. The browser validates the ID against a fixed profile allowlist. Unknown values map to
   `calm`.
5. The engine uses exponential easing with a default 420 ms transition. Frame delta is
   bounded to prevent large jumps after a suspended tab.
6. When analysis is disabled, unavailable, unsupported, malformed, or below threshold,
   the avatar returns to calm.

## Safety and privacy invariants

- User opt-in remains required; this feature does not enable emotion analysis by default.
- Only the existing confidence gate can enable a non-neutral profile.
- Emotion estimates cannot grant tools, permissions, OS access, or authority to perform
  actions.
- A visual profile is temporary UI state, not a persistent user profile.
- Transcript text, microphone data, and provider internals are not copied into visual
  profile metadata or operational audit events.
- No webcam inference or raw-audio emotion recognition is added.
- Failure at any layer uses the calm visual fallback and does not stop the conversation.

## Verification

Run `node --test tests/js/*.test.cjs` and `python -m pytest`. The JS tests cover the
profile allowlist, smooth interpolation, unknown labels, bounded delta time, idempotent
targets, and reset behavior.
