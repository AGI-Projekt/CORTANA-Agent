# Roadmap

Status is updated only when implementation and tests have been verified.

## Phase 0 — repository foundation
- [x] Central repository and modular package layout.
- [x] Windows/Linux CI workflow.
- [x] Package metadata, architecture/security docs, and smoke tests.
- [x] Deterministic agent core, bounded volatile memory, and allowlisted tool registry.
- [x] Structured self-improvement proposals with review-and-rollback procedure.

## Phase 1 — interfaces and tests
- [x] Core request/response contracts.
- [x] Tool permission and argument-validation contract.
- [x] Memory with explicit limits, retention, and clearing.
- [x] LLM provider protocol and deterministic adapter tests.
- [x] Session-scoped, volatile conversation history.
- [x] Emotion provider injection with confidence-gated tone adaptation and neutral fallback.
- [ ] Formal API schemas and structured audit events.
- [ ] Observability, metrics, and replayable evaluations.

## Phase 2 — Emotion Core integration
- [x] Preserve existing Emotion Core source and contract tests.
- [x] Adapter for the existing Emotion Core 1.3 contract.
- [x] Hook EmotionProvider into conversation core without granting permissions.
- [ ] Validate against the original Emotion Core archive on a local system.
- [ ] Confirm archive redistribution/license and define versioned release method.
- [ ] Define versioned schemas for temporal and multimodal extensions.

## Phase 3 — capabilities
- [x] OpenAI Responses API provider adapter (requires optional SDK and runtime credentials).
- [x] Interactive terminal runtime and offline demo.
- [ ] Verify a live API call using a maintainer-provided key; CI uses mocks and needs no secrets.
- [ ] Optional speech and vision adapters with visible sensor controls.
- [ ] Bounded planning and approval-gated tool execution.
- [ ] Persistent memory after retention/deletion controls and security review.

## Phase 4 — interfaces and extensions
- [ ] Windows desktop interface.
- [ ] Linux development/runtime support beyond the core.
- [ ] Optional web UI and Unreal Engine presentation.

## Release criteria

A phase is complete only when its acceptance criteria, tests, and security checks pass. Self-improvement must preserve isolation, review, CI, and rollback.
