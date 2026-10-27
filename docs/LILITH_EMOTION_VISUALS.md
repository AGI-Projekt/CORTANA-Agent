# Lilith Cortana Nebiru — Emotion Visual Profiles v1.0

## Scope

This layer adds eight allowlisted avatar expressions to the Emotion Core integration:
**calm (spokój), joy (radość), sadness (smutek), anger (złość), fear (strach), surprise
(zaskoczenie), disgust (odraza), and determination (determinacja)**.

The browser's procedural avatar uses each profile to adjust eye openness, mouth shape,
head tilt, and hologram accent lighting. The labels describe a presentation animation,
not a verified emotional state of the user and not a claim that the AI has subjective
feelings. The artwork generated for this feature is a concept sheet, not a rigged 3D
model or a set of production-ready motion-capture assets.

## Data flow

1. Emotion analysis remains opt-in on the Realtime transcript path.
2. The provider's estimate must pass the existing may_adjust_tone confidence gate.
3. The server maps the allowlisted category to an expression ID with
   resolve_visual_expression.
4. The API returns only a short expression ID and a coarse response style; it does not
   return or log the transcript or the complete provider estimate.
5. The browser applies a local, bounded visual preset to the avatar. When analysis is
   disabled, unavailable, unsupported, malformed, or below confidence threshold, the
   avatar returns to calm.

## Expression contract

The stable IDs are calm, joy, sadness, anger, fear, surprise, disgust, and determination.
Unknown IDs must be treated as calm. Accent colors and facial parameters are visual-only
and may be adjusted independently of the emotion inference layer.

## Safety and privacy invariants

- User opt-in remains required; this feature does not enable emotion analysis by default.
- Only the existing high-confidence gate can enable a non-neutral profile.
- Emotion estimates cannot grant tools, permissions, access to the operating system,
  or authority to perform actions.
- A visual profile is temporary UI state, not a persistent user profile.
- Transcript text, microphone data, and provider internals are not copied into visual
  profile metadata or operational audit events.
- No webcam inference or raw-audio emotion recognition is added by this change.
- Failure at any layer uses the calm visual fallback and does not stop the conversation.

## Verification

Run the repository's unit suite with:

    python -m pip install -e ".[test,web]"
    python -m pytest

The unit tests verify the eight mappings, allowlist behavior, unsupported labels, disabled
state, and the existing confidence gate.
