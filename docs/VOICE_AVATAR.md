# Voice and avatar prototype

## Pipeline

1. The user explicitly presses the microphone control and grants browser microphone permission.
2. The browser records a short audio clip in memory and uploads it to /api/transcribe when recording stops.
3. The server validates extension and size, then calls the configured transcription provider.
4. The transcript is submitted to the normal Cortana request/response workflow.
5. The browser shows the text response and, when enabled, uses built-in SpeechSynthesis to speak it.
6. Avatar states animate listening, thinking, and speaking. Mouth animation uses speech events where available.

## Installation

Install the optional LLM and web dependencies:

```bash
python -m pip install -e ".[llm,web]"
export OPENAI_API_KEY="your-key-from-the-provider"
python -m cortana.web
```

Open http://127.0.0.1:8000. The API key stays on the server. Do not expose this prototype beyond loopback without authentication, rate limiting, and transport-security controls.

For an offline text-only UI set CORTANA_OFFLINE=1. Transcription still needs credentials and access to the provider API.

## Current scope

- Transcription uses the current gpt-transcribe model. See the official speech-to-text guide: https://developers.openai.com/api/docs/guides/speech-to-text
- Speech output uses browser-native SpeechSynthesis rather than a separate API TTS model. Installed voices vary by OS, browser, and language. The interface discloses synthetic speech.
- Captured audio is not written to disk by this app. Audio is sent to the configured transcription provider, so do not submit private recordings without authorization.
- The application limits uploads to 25 MiB and rejects unsupported file extensions.
- The SVG avatar is an animated 2D stand-in, not a rigged 3D model, Unreal Engine project, or physical hologram.
- Emotion estimates are not shown as facts about the user. This UI animates operational states; tone guidance remains in the core's optional provider integration.

## Security and release requirements

Before non-local deployment, add authentication, rate limiting, HTTPS, deployment configuration, safe logging, quotas, and a reviewed retention policy. The default server binds to loopback. Browser microphone capture usually requires localhost or a secure context such as HTTPS.


## Realtime voice and 3D presentation

Use the button marked “Połącz głos na żywo” to initiate a direct Realtime WebRTC session. The server creates a short-lived client secret using the permanent API key; that permanent key never enters browser code. The browser requests microphone permission only after the click and sends audio to the Realtime session. Press “Zakończ rozmowę” to close the peer connection and stop the microphone tracks.

Configuration is server-side:

- CORTANA_REALTIME_MODEL (default gpt-realtime-2.1)
- CORTANA_REALTIME_VOICE (default marin)
- CORTANA_REALTIME_TRANSCRIPTION_MODEL (default gpt-4o-mini-transcribe)

The browser voice chooser allows a supported voice per new session. The voice is fixed after the live session starts. The model is instructed to speak Polish, and input transcription is configured for Polish. The live Realtime session has no tools and is separate from the regular CortanaAgent text path; it does not currently invoke the Emotion Core adapter or the agent's in-process text history.

The 3D prototype uses Three.js from a version-pinned CDN import. A 2D SVG fallback remains visible if WebGL initialization fails. Animations represent operational states; the current mouth movement is approximate and is not phoneme/viseme-accurate lip sync.

Important: the Realtime service is metered and requires access to the configured model. The local offline demo does not provide live audio. Do not expose the local server publicly without authentication, rate limiting, and deployment hardening. Live voice is an AI-generated voice, not a human recording.


## Response-style visualization

The avatar can display one of four coarse presentation cues: neutral, supportive, exploratory, or upbeat. The API emits a non-neutral cue only when the core explicitly marks tone adjustment as allowed. The cue describes response presentation, not a verified emotion or diagnosis of the user. Missing, low-confidence, unknown, or disabled estimates fall back to neutral. The cue is local UI state and is not stored as a persistent user profile.
