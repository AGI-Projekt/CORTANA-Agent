# CORTANA-Agent

**Project:** Lilith Cortana Nebiru  
**Target platforms:** Windows first, Linux supported for development and runtime.

CORTANA-Agent is the central repository for a modular, cross-platform conversational agent. The current branch establishes the project scaffold; it does not imply that planned capabilities are already implemented.

## Current status
- Repository foundation and package layout are being prepared.
- The shared core is intended to remain independent from platform-specific interfaces.
- Emotion Core will integrate through an adapter after its existing archives are inventoried and regression-tested.
- Perception, memory, planning, speech, vision, desktop UI, and Unreal Engine integrations are roadmap items, not current implementation claims.

## Principles
- Modular boundaries and explicit interfaces.
- Least-privilege tool execution.
- Tests and review for behavior-changing code.
- No secrets or private sensor data in source control.
- Self-modification, when introduced, must run in an isolated branch or sandbox with tests, review, and rollback.

## Repository map
- `src/cortana/`: Python package and planned component boundaries.
- `tests/`: unit, integration, security, and regression test locations.
- `docs/ARCHITECTURE.md`: system boundaries.
- `docs/SECURITY.md`: security baseline.
- `docs/CONTRIBUTING.md`: contribution workflow.
- `docs/ROADMAP.md`: proposed implementation sequence.

## Development
Requires Python 3.12 or newer.

```bash
python -m venv .venv
# Linux
source .venv/bin/activate
# Windows PowerShell:
# .venv\\Scripts\\Activate.ps1
python -m pip install -e ".[test]"
python -m pytest -q
```

See `.env.example` for local configuration placeholders. Do not add real secrets to Git.
