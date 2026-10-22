# CORTANA-Agent

**Project:** Lilith Cortana Nebiru  
**Target platforms:** Windows first, Linux supported for development and runtime.

CORTANA-Agent is a modular, cross-platform conversational agent foundation. It includes an initial deterministic core, an optional real LLM provider adapter, bounded volatile conversation memory, an allowlisted tool registry, a pluggable Emotion Core contract, and a controlled self-improvement proposal store. This is an early-stage project, not a complete AGI or holographic runtime.

## Implemented starter components

- **Core:** request/response contracts, provider protocol, session-scoped conversation history, and explicit session clearing.
- **LLM:** optional OpenAI Responses API adapter configured through environment variables.
- **Emotion:** injected EmotionProvider with conservative tone-only behavior; Emotion Core 1.3 still requires its separate package on PYTHONPATH.
- **Memory:** bounded in-process history with retention and explicit clearing; not persisted to disk.
- **Tools:** explicit allowlist and required-argument validation; no implicit shell access.
- **Self-improvement:** structured JSON proposals and a human-reviewed workflow; proposal data is never executed.
- **CI:** GitHub Actions test matrix for Windows/Linux and Python 3.12.

Speech, image perception, persistent memory, desktop UI, and holographic/Unreal presentation remain future work.

## Quick start

Requires Python 3.12 or newer.

Install test dependencies:

```bash
python -m pip install -e ".[test]"
python -m pytest -q
```

Run the deterministic offline demo:

```bash
python -m cortana --offline
```

For a real LLM, install the optional provider and export your API key:

```bash
python -m pip install -e ".[llm]"
export OPENAI_API_KEY="your-key-from-the-provider"
python -m cortana
```

Windows PowerShell:

```powershell
$env:OPENAI_API_KEY = "your-key-from-the-provider"
python -m cortana
```

See docs/LLM_PROVIDER.md for model settings and privacy boundaries.

## Security and project status

See .env.example, docs/SECURITY.md, and docs/SELF_IMPROVEMENT.md. Never commit credentials or private sensor data. Emotion estimates can adjust tone only and never grant permissions. Feature status is recorded in docs/ROADMAP.md.
