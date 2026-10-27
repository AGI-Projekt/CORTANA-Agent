# CORTANA-Agent

**Project:** Lilith Cortana Nebiru  
**Target platforms:** Windows first, Linux supported for development and runtime.

CORTANA-Agent is a modular conversational agent foundation. It includes a model adapter, bounded volatile conversation memory, a tool allowlist, a pluggable Emotion Core contract, a controlled self-improvement proposal store, and a first browser voice/avatar prototype.

## Voice + avatar prototype

- Browser interface with a procedurally generated WebGL/Three.js 3D avatar and states for listening, thinking, speaking, and idle.
- Eight opt-in, confidence-gated visual expressions for Lilith Cortana Nebiru, with neutral fallback and no permission escalation.
- Full-duplex Realtime API voice via WebRTC with a short-lived browser credential and selectable voice.
- Explicit microphone permission and a manual record/stop workflow.
- Speech transcription with the gpt-transcribe audio model, a 25 MiB request limit, and no local audio-file persistence.
- Text replies through the existing Cortana agent.
- Browser-native speech synthesis; quality and language depend on voices installed on the device.
- Session-scoped volatile chat history with a clear-session control.
- Local-only server default. No authentication is provided; do not expose the prototype to the public internet.

The avatar is a procedural 3D prototype, not a rigged photorealistic character or Unreal Engine scene. Production authentication, realtime moderation/observability, and a maintained local copy of Three.js remain future work.

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

Open http://127.0.0.1:8000. Offline text mode does not use the live voice connection.

For real model responses, uploaded transcription, and live WebRTC voice:

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

Never commit API keys or put them in the browser. The live voice endpoint returns only a short-lived Realtime client secret; the standard API key remains server-side. The server binds to 127.0.0.1 by default. Microphone permission requires localhost or HTTPS. Voice choice is per session and must be selected before connecting.

## Existing components

- Core request/response contracts and optional OpenAI Responses provider.
- Session memory stored only in process RAM.
- Emotion Core 1.3 adapter contract; its external package must be installed separately.
- Tool registry with explicit allowlist.
- Structured self-improvement proposals requiring review and tests.

See docs/VOICE_AVATAR.md, docs/LLM_PROVIDER.md, docs/EMOTION_CORE_INTEGRATION.md, and docs/SELF_IMPROVEMENT.md.


## Viseme timing API

The browser includes an experimental timestamp-based viseme timeline API for future audio-aligned sources. The current transcript-driven path remains approximate; the project does not yet claim phoneme-accurate lip sync. The CI pipeline runs deterministic Node.js tests for timeline timing, validation, cancellation, and reset behavior.


## Audio-synchronized viseme clock

audio-clock.js bridges AudioContext.getOutputTimestamp() with the monotonic clock used by the viseme timeline and falls back explicitly when unsupported. It exposes the playout anchor for a future source of audio-aligned viseme timestamps. The current Realtime transcript-driven mouth shapes remain approximate; no phoneme alignment is inferred from transcript timing alone.
