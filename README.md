# CORTANA-Agent

**Project:** Lilith Cortana Nebiru  
**Target platforms:** Windows first, Linux supported for development and runtime.

CORTANA-Agent is a modular, cross-platform conversational agent foundation. This repository now includes an initial deterministic agent core, bounded volatile conversation memory, an allowlisted tool registry, and a controlled self-improvement proposal store. It is an early-stage scaffold, not a complete AGI, hologram, or autonomous deployment system.

## Implemented starter components
- **Core:** request/response contracts and provider protocol with an offline echo implementation.
- **Memory:** bounded in-process history with configurable age retention and explicit clearing. It is not persisted to disk.
- **Tools:** explicit allowlist, required-argument validation, and no implicit shell access.
- **Self-improvement:** structured JSON proposals, acceptance criteria, and a human-reviewed workflow. Proposal data is never executed.
- **CI:** existing Windows/Linux GitHub Actions test matrix.

Emotion Core integration remains behind its adapter contract; see `docs/EMOTION_CORE_INTEGRATION.md`. Speech, vision, long-term memory, desktop UI, and holographic/Unreal presentation remain future work.

## Quick start
Requires Python 3.12 or newer.

```bash
python -m venv .venv
# Linux/macOS
source .venv/bin/activate
# Windows PowerShell: .venv\\Scripts\\Activate.ps1
python -m pip install -e ".[test]"
python -m pytest -q
```

Minimal usage:

```python
from cortana.core import AgentRequest, CortanaAgent
agent = CortanaAgent()
response = agent.respond(AgentRequest("Cześć, Cortano!"))
print(response.text)
```

## Configuration and security
See `.env.example`, `docs/SECURITY.md`, and `docs/SELF_IMPROVEMENT.md`. Never commit credentials or personal sensor data. Do not give the agent broad repository, operating-system, or secret-management privileges.

## Project status
This repository contains an executable foundation. Roadmap items are not claims of completed functionality. See `docs/ROADMAP.md`.
