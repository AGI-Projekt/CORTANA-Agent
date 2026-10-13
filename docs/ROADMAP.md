# Roadmap

This is a proposed sequence. Status should be updated only after implementation and tests are verified.

## Phase 0 — repository foundation
- [x] Create the central private repository.
- [x] Preserve the initial README and main branch.
- [x] Add initial architecture, security, and contribution documentation.
- [ ] Add packaging metadata, cross-platform CI, and validate the workflow.
- [ ] Add branch protection after CI exists.

## Phase 1 — interfaces and tests
- [ ] Define core request/response contracts.
- [ ] Define tool permission and audit contracts.
- [ ] Define memory interfaces without prematurely choosing a storage backend.
- [ ] Define the Emotion Core adapter contract.
- [ ] Add unit and regression tests.

## Phase 2 — Emotion Core integration
- [ ] Inventory the supplied Emotion Core archives.
- [ ] Specify versioning, schemas, and error handling.
- [ ] Integrate through an adapter; preserve original prototypes.
- [ ] Verify tests on Windows and Linux.

## Phase 3 — capabilities
- [ ] Add model/LLM adapter.
- [ ] Add optional speech and vision adapters.
- [ ] Add bounded planning, approvals, and observable tool execution.
- [ ] Add memory after retention and deletion rules are defined.

## Phase 4 — interfaces and extensions
- [ ] Windows desktop interface.
- [ ] Linux development/runtime support.
- [ ] Optional web UI and Unreal Engine integration.

## Release criteria
A phase is complete only when its acceptance criteria, tests, and security checks pass. Planned features are not implementation claims.
