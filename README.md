# CORTANA-Agent

**Project:** Lilith Cortana Nebiru  
**Target platforms:** Windows first, Linux supported for development and runtime.

CORTANA-Agent is a modular conversational agent foundation. It includes a model adapter, bounded volatile conversation memory, a tool allowlist, a pluggable Emotion Core contract, a controlled self-improvement proposal store, and a first browser voice/avatar prototype.

## Voice + avatar prototype

- Browser interface with a stylized animated SVG avatar and states for listening, thinking, speaking, and idle.
- Explicit microphone permission and a manual record/stop workflow.
- Speech transcription with the gpt-transcribe audio model, a 25 MiB request limit, and no local audio-file persistence.
- Text replies through the existing Cortana agent.
- Browser-native speech synthesis; quality and language depend on voices installed on the device.
- Session-scoped volatile chat history with a clear-session control.
- Local-only server default. No authentication is provided; do not expose the prototype to the public internet.

This is a visual prototype, not a true 3D hologram or Unreal Engine scene. Full-duplex voice and production authentication remain future work.

## Install and run

Requires Python 3.12 or newer.

Offline text UI:

```bash
python -m pip install -e ".[test,web]"
```

Set offline mode and start the browser interface:

```bash
# Linux/macOS
export CORTANA_OFFLINE=1
python -m cortana.web
```

Open http://127.0.0.1:8000. Voice transcription still needs API credentials.

For real model responses and speech-to-text:

```bash
python -m pip install -e ".[llm,web]"
# Linux/macOS
unset CORTANA_OFFLINE
export OPENAI_API_KEY="your-key-from-the-provider"
python -m cortana.web
```

Windows PowerShell:

```powershell
python -m pip install -e ".[llm,web]"
Remove-Item Env:CORTANA_OFFLINE -ErrorAction SilentlyContinue
$env:OPENAI_API_KEY = "your-key-from-the-provider"
python -m cortana.web
```

Never commit API keys or put them in the browser. The server binds to 127.0.0.1 by default. Microphone permission typically requires localhost or HTTPS.

## Existing components

- Core request/response contracts and optional OpenAI Responses provider.
- Session memory stored only in process RAM.
- Emotion Core 1.3 adapter contract; its external package must be installed separately.
- Tool registry with explicit allowlist.
- Structured self-improvement proposals requiring review and tests.

See docs/VOICE_AVATAR.md, docs/LLM_PROVIDER.md, docs/EMOTION_CORE_INTEGRATION.md, and docs/SELF_IMPROVEMENT.md.
