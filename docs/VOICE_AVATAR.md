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

The avatar retains four coarse response-tone cues (neutral, supportive, exploratory, upbeat) and now also has eight local visual expressions: calm, joy, sadness, anger, fear, surprise, disgust, and determination. The server supplies only an allowlisted expression ID after the existing opt-in and confidence gates. The browser uses it to animate eye openness, mouth shape, head tilt, and hologram accent lighting. This describes a temporary presentation animation, not a verified emotion or diagnosis of the user. Missing, low-confidence, unknown, disabled, or unavailable estimates fall back to calm/neutral. Visual state is not stored as a persistent user profile. See docs/LILITH_EMOTION_VISUALS.md.


## Optional Realtime Emotion Core guidance and audit

The realtime transcript-to-style path is opt-in in the browser and off by default. To make Emotion Core 1.3 available on the server, set CORTANA_REALTIME_EMOTION=1 and make its package importable on PYTHONPATH. The user must separately enable the “Dopasuj styl (opcjonalnie)” checkbox before final voice transcripts are sent to the server for analysis.

The server returns a coarse response style, an allowlisted visual expression ID, and a fixed server-authored Realtime instruction hint. Audit records do not retain transcript text. The instruction update is sent over the Realtime data channel and guides subsequent responses; the current spoken response may already be underway when transcription completes. Disabling the checkbox resets the avatar expression to calm and requests neutral session instructions.

Operational audit records are bounded and in-memory by default. They contain only timestamp, event type, coarse outcome, and duration; no transcript, audio, user/session identifier, inferred category, model output, or API secret. Provider errors and invalid request correlation fall back to neutral presentation.


## Audio-driven 3D facial animation

The WebRTC remote audio stream is sampled locally with the Web Audio API analyser. A smoothed RMS energy value drives mouth opening in the procedural Three.js avatar and the SVG fallback; audio itself is not copied into audit records or sent to an additional endpoint for lip-sync. The 3D avatar also performs procedural blink cycles and uses a subtle fallback mouth motion when live audio analysis is unavailable.

This is energy-driven mouth motion, not phoneme/viseme-accurate lip synchronization. Better lip sync will require audio-aligned visemes or a rigged character with blend shapes. Analyser resources and the animation loop are stopped when the live session is disconnected.


## Approximate viseme controller

The Realtime output transcript stream now feeds a bounded character-to-viseme scheduler. Polish vowel and bilabial/labiodental graphemes map to coarse mouth profiles (open, mid, wide, round, closed, teeth); Three.js and the 2D fallback consume the same visual cue family with smoothed transitions. This provides more articulation variety than pure amplitude-driven opening.

Important limitation: transcript text deltas are not time-aligned phoneme or viseme timestamps. The scheduler therefore uses estimated per-character durations and is only an approximation. It does not claim phoneme-accurate synchronization. Production lip sync should consume trusted audio-aligned viseme/phoneme timestamps and drive a properly rigged avatar's blend shapes.


## Timestamped viseme timeline contract

The browser scheduler supports a future audio-aligned input contract through CortanaVisemeScheduler.playTimeline(events, anchorTimeMs). Each event carries a known viseme name plus atMs and durationMs relative to a caller-supplied monotonic-clock anchor (the same clock domain as performance.now()). Event count, offsets, durations, and allowed profile names are bounded and validated before current animation is interrupted. Reset cancels all scheduled timers and returns the face to neutral.

This API is a timing-capable interface, not a source of accurate timings. The current Realtime path still receives transcript deltas and uses approximate grapheme durations; it does not call playTimeline with acoustic phoneme timings. Exact alignment remains blocked on a provider that emits audio-aligned phoneme/viseme timestamps. Node-based deterministic tests validate cue timing, future anchors, malformed input, cancellation, and coexistence with the approximate text scheduler.


## Audio playout clock bridge

The browser-side audio-clock.js adapter maps Web Audio output timestamps to the same monotonic performance.now() clock used by viseme scheduling. When getOutputTimestamp() is unavailable or invalid, it reports an explicit performance-clock fallback. The remote WebRTC audio is routed through MediaStreamAudioSourceNode → AnalyserNode → AudioContext.destination so analyser and audible output share a Web Audio clock domain instead of separate HTML media and analyser clocks.

On the first audible output frame of a response, the browser captures an output-clock anchor and dispatches cortana:audio-playout-anchor. Integrators can pass the returned anchorTimeMs to CortanaVisemeScheduler.playTimeline(events, anchorTimeMs) or use CortanaAudioClock.scheduleTimeline(scheduler, events). This bridge does not generate acoustic phoneme/viseme timestamps by itself. The current text-driven path remains approximate. The anchor is reset for each Realtime response and when the session closes.


## External audio-aligned viseme provider contract

The browser exposes a provider-neutral CortanaVisemeProvider adapter. A trusted adapter may send an application-defined Realtime data-channel event with type "cortana.viseme.timeline", a response_id matching the active response, and an events array. Each event contains audioTimeSeconds (in the same AudioContext clock as the captured output anchor), durationMs, viseme, and optional character. The adapter validates response correlation, event count, timestamps, durations, character length, and the viseme allowlist before scheduling. Stale or mismatched response timelines are rejected. Once valid aligned cues are accepted, approximate transcript-grapheme cues are suppressed for that response.

Important: this is an integration contract, not a claim that the current Realtime API emits these custom events. The built-in Realtime transcript events still do not provide acoustic phoneme/viseme timestamps. A separate trusted provider/adapter must generate and send this event. Until then, the browser continues using approximate transcript cues. Never label transcript-derived estimates as audio-aligned.
