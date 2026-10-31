# Stage 12.1 — Unreal Engine 5 receiver

## Scope

This stage adds the source of a UE5 Runtime plugin that receives the Stage 12 browser sender's WebSocket protocol v1. It is a receiver foundation, not a finished holographic character integration. The repository does not currently contain a target Unreal project, a MetaHuman asset, an Animation Blueprint, or a verified Control Rig mapping.

## Plugin layout

Enable Plugins/CortanaAvatarReceiver/CortanaAvatarReceiver.uplugin in the target UE5 project. The plugin depends on the engine WebSockets and Json modules and exposes UCortanaAvatarReceiverComponent to Blueprints.

Add the component to an Actor, then call ConnectToEndpoint explicitly with the receiver URL. Bind to OnFrameReceived to consume FCortanaAvatarFrame. The frame exposes state, emotion, viseme, audio level, sequence, sender timestamp, and a map of the 13 facial channels.

Example Blueprint flow:

1. Begin Play (or an explicit user-controlled presentation action).
2. Call ConnectToEndpoint with the local or secured WebSocket endpoint.
3. Bind OnFrameReceived and update the character's animation parameters.
4. On End Play, call DisconnectFromEndpoint.

No connection is initiated automatically by the plugin.

## Receiver validation

The receiver rejects:
- messages that are empty, malformed JSON, or larger than 16 KiB;
- an unexpected message type or protocol version other than 1;
- missing/non-finite/negative timestamps and invalid sequence values;
- unknown state, emotion, or viseme labels;
- audio or blendshape values outside [0, 1];
- frames whose sequence is not greater than the last accepted sequence.

The message is parsed and validated in the WebSocket callback. A validated frame is then queued to the Game Thread before updating the component and broadcasting the Blueprint event. The component returns its current frame to neutral after the configurable frame timeout (default 0.5 seconds) or a socket close.

The sender's timestampMs is a sender-local monotonic clock, not synchronized with Unreal's clock. The receiver therefore uses local arrival time for timeout handling and does not compare sender timestamps to local wall-clock time.

## Transport and deployment

The component allows wss:// for remote hosts and ws:// only for localhost/loopback development. This is transport policy, not authentication. The current plugin does not implement user authentication, origin allowlisting, authorization, or server-side rate limiting. Keep the receiver bound to localhost or a trusted development network until those controls are implemented by the host application/deployment.

## Rig integration still required

The plugin does not assume that generic channel names match MetaHuman control names. In the target project:
- map the 13 normalized channels to the selected character's Morph Targets or Control Rig controls;
- combine viseme and expression contributions in an Animation Blueprint with explicit per-channel priorities/limits;
- keep body gestures as a separate animation layer;
- add interpolation/smoothing at the rig layer if needed;
- verify neutral pose, timeout behavior, reconnect behavior, and frame latency on the actual rig.

No MetaHuman-specific mapping is included because the target MetaHuman version and rig are not part of this repository.

## Verification status

The source and plugin descriptor have been added to the repository. A UE5 build has not been claimed: the repository does not include a UE project, and this environment has not run UnrealBuildTool. The next acceptance gate is to enable the plugin in the target UE5 project, compile it against the exact engine version, and run a local sender/receiver test with a real character rig.
