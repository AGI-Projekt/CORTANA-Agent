# Cortana — architecture baseline

## Purpose
CORTANA-Agent is the central cross-platform agent project for Windows and Linux. This document establishes a proposed architecture; it does not claim that planned components are already implemented.

## Principles
- Keep the orchestration core independent of the UI and operating system.
- Place platform-specific functionality behind explicit adapters.
- Keep core, memory, emotion modelling, perception, planning, tools, and runtime separately testable.
- Apply least privilege to tools. Emotion state must never grant permissions.
- Require tests, review, traceable changes, and rollback for host-impacting code.
- Keep secrets and private user data out of source control.

## Proposed boundaries
- `core/`: request lifecycle, orchestration, policies, routing.
- `emotion/`: computational affect model and adapter to the existing Emotion Core prototype.
- `memory/`: interfaces for episodic, semantic, and vector memory.
- `perception/`: optional text, audio, camera, and stream adapters.
- `planning/`: bounded task planning and validation.
- `tools/`: tool registry, permissions, validation, audit trail.
- `runtime/`: lifecycle, configuration, health checks.
- `platform/windows/` and `platform/linux/`: OS-specific adapters.
- `api/`: versioned interfaces between components and front ends.

## Integration rule
Do not replace existing Emotion Core archives blindly. Inventory them, define an adapter contract, and add regression tests first. The initial scaffold does not yet implement these components.
