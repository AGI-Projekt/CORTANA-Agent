# Roadmap

Status is updated only when implementation and tests have been verified.

## Phase 0 — repository foundation
- [x] Central repository and modular package layout.
- [x] Windows/Linux CI workflow.
- [x] Package metadata, initial security/architecture docs, smoke tests.
- [x] Deterministic agent core, bounded volatile memory, allowlisted tool registry.
- [x] Structured self-improvement proposals with review-and-rollback procedure.
- [ ] Branch protection, secret scanning, dependency automation.

## Phase 1 — interfaces and tests
- [x] Core request/response contracts.
- [x] Tool permission and argument-validation contract.
- [x] Memory with explicit limits, retention, and clearing.
- [ ] Formal API schemas and structured audit events.
- [ ] Observability, metrics, and replayable evaluations.

## Phase 2 — Emotion Core integration
- [x] Preserve existing Emotion Core source and contract tests.
- [x] Initial adapter contract and audit documents.
- [ ] Complete regression validation against the original prototype in Windows/Linux CI.
- [ ] Define versioned event schemas and integration examples.

## Phase 3 — capabilities
- [ ] LLM provider adapters and explicit timeouts/budgets.
- [ ] Optional speech and vision adapters with visible sensor controls.
- [ ] Bounded planning and approval-gated tool execution.
- [ ] Persistent memory after retention/deletion controls and security review.

## Phase 4 — interfaces and extensions
- [ ] Windows desktop interface.
- [ ] Linux development/runtime support beyond the core.
- [ ] Optional web UI and Unreal Engine presentation.

## Release criteria
A phase is complete only when its acceptance criteria, tests, and security checks pass. Self-improvement must preserve isolation, review, CI, and rollback.
