# Stage 12 — Unreal Engine 5 holographic bridge

## Goal

Provide a versioned bridge from the browser avatar runtime to an Unreal Engine 5 receiver. This stage implements the wire contract and browser sender; it does not claim that an Unreal project, MetaHuman asset, Control Rig, or packaged hologram already exists.

## Data flow

`Emotion Core / viseme timeline → Facial Intelligence → CortanaUnrealBridge → WebSocket → Unreal receiver → Animation Blueprint / Control Rig`

The browser remains functional when disconnected. The bridge is opt-in and never connects automatically.

## Browser sender

```js
const bridge = window.CortanaUnrealBridge.createUnrealBridge();
bridge.connect("wss://your-host.example/avatar");
```

For local development only, `ws://localhost` and loopback addresses are allowed. Remote endpoints must use `wss://`. Assign the connected instance to `window.CortanaUnrealBridgeRuntime` so the avatar renderer can publish frames: `window.CortanaUnrealBridgeRuntime = bridge`. Call `publish({ state, emotion, viseme, audioLevel, facial, timestampMs })` with the current avatar frame when publishing manually. The sender defaults to ~30 Hz, clamps numeric channels to [0, 1], allowlists state/emotion/viseme labels, adds a monotonically increasing sequence, and exposes dropped-frame counters. Call `disconnect()` when the presentation session ends.

The avatar runtime publishes frames only after an application explicitly creates and connects a bridge. No microphone samples, transcript, prompt, credentials, or conversation history are sent.

## Wire contract v1

Each WebSocket text message is one JSON object containing:
- `type`: `cortana.avatar.frame`
- `version`: integer `1`
- `sequence`: increasing integer per connection
- `timestampMs`: sender monotonic-clock milliseconds, not synchronized wall-clock time
- `state`: `idle | listening | thinking | speaking`
- `emotion`: `calm | joy | sadness | anger | fear | surprise | disgust | determination`
- `viseme`: `neutral | open | mid | wide | round | closed | teeth`
- `audioLevel`: normalized output activity [0, 1]
- `blendshapes`: 13 normalized Stage 11 channels

The receiver must reject unknown versions, malformed/oversized messages, non-increasing sequences, stale frames, and out-of-range values. It should interpolate accepted frames and return to neutral on timeout/disconnect. Authentication, origin allowlisting, TLS termination, rate limiting, and deployment authorization are mandatory before exposing a receiver beyond localhost.

## Unreal receiver mapping

Implement a UE5 plugin or project module with a single, documented WebSocket topology. Parse messages off the game thread, validate them, then enqueue the latest accepted frame for game-thread application. Map the 13 channels to the selected character's Morph Targets or Control Rig controls. Blend expression and viseme channels in an Animation Blueprint; keep body gestures as a separate layer. MetaHuman control names must be mapped against the actual selected MetaHuman rig/version, not assumed to match generic blendshape names.

## Acceptance criteria

- Browser bridge unit tests pass on Windows and Linux CI.
- No connection is made unless a caller explicitly invokes `connect`.
- Remote insecure WebSocket URLs are rejected.
- Frames are bounded, versioned, sequenced, and rate-limited.
- Disconnect or missing receiver does not break the browser avatar.
- UE receiver validates frames and neutralizes the face after timeout.
- A real UE5 project build and rig mapping are required before claiming end-to-end integration.
