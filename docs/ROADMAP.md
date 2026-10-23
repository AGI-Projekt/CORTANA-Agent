# Roadmap

Status is updated only when implementation and tests have been verified.

## Phase 0 — repository foundation
- [x] Central repository and modular package layout.
- [x] Windows/Linux CI workflow.
- [x] Package metadata, architecture/security docs, and smoke tests.
- [x] Deterministic agent core, bounded volatile memory, and allowlisted tool registry.
- [x] Structured self-improvement proposals with review-and-rollback procedure.

## Phase 1 — conversational core
- [x] Core request/response contracts.
- [x] Tool permission and argument-validation contract.
- [x] Bounded session history with explicit clearing.
- [x] Optional OpenAI Responses API text adapter.
- [x] Emotion provider injection with confidence-gated tone adaptation and neutral fallback.
- [x] Interactive terminal runtime and offline demo.

## Phase 2 — voice and avatar prototype
- [x] Optional speech transcription adapter using gpt-transcribe.
- [x] Local FastAPI endpoints for chat, session clearing, and transcription.
- [x] Browser UI with a procedural SVG avatar and state animations.
- [x] Manual microphone permission, recording control, and upload limits.
- [x] Browser-native speech synthesis with synthetic-voice disclosure.
- [x] Mock-backed tests for audio and web routes; Windows/Linux CI.
- [x] Coarse emotion-guided avatar presentation cues with neutral fallback and tests.
- [ ] Validate live transcription and a live voice conversation with a maintainer-managed key.
- [x] Add a procedural Three.js WebGL avatar with a 2D fallback.
- [x] Add a full-duplex Realtime API/WebRTC path with a short-lived client secret.
- [x] Add a per-session voice chooser, Polish transcription configuration, and explicit connect/disconnect.
- [ ] Replace procedural geometry with a designed, rigged 3D avatar and proper viseme lip sync.
- [ ] Add production authentication, rate limiting, and deployment hardening.
- [x] Add opt-in Realtime transcript-to-Emotion Core guidance with neutral fallback and privacy-limited audit records.
- [ ] Validate opt-in behavior against a locally installed Emotion Core package and live Realtime key.
- [ ] Add production authentication, rate limiting, moderation and deployment hardening.

## Phase 3 — multimodal and presentation
- [ ] Vision adapter with consent and explicit camera activation.
- [ ] Temporal Emotion Core integration after archive and licensing review.
- [ ] Native desktop shell or Unreal Engine presentation.
- [ ] Lip-sync from speech timing/visemes for a rigged avatar.

## Phase 4 — controlled improvement
- [x] Structured proposals and human-reviewed improvement workflow.
- [ ] Isolated PR generation with scoped credentials and required checks.
- [ ] Replayable task evaluations, metrics, and rollback drills.

## Release criteria

A phase is complete only when tests, security checks, and acceptance criteria pass. This voice/avatar stage is a local prototype, not a production deployment.
