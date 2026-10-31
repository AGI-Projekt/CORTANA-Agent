# Stage 12.2 — MetaHuman rig integration and Animation Blueprint

## Scope and status

Stage 12.2 adds a generic, data-driven UE5 adapter between the Stage 12.1 receiver and a character rig. It supports direct Morph Target application and publishes normalized facial channels to Blueprint so a project can route them into an Animation Blueprint or Control Rig.

This is not a preconfigured MetaHuman mapping. MetaHuman control names vary by character setup and engine/plugin version. The repository does not include the target .uproject, MetaHuman asset, face skeleton, Morph Target list, Control Rig graph, or Animation Blueprint. No guessed MetaHuman control names are shipped; no UE build or end-to-end rig test is claimed.

## Plugin additions

- UCortanaMetaHumanMappingAsset: per-character Data Asset with source channel, optional exact Morph Target name, enable flag, scale/bias, and attack/release interpolation speeds.
- UCortanaMetaHumanRigComponent: subscribes to UCortanaAvatarReceiverComponent, maps the 13 normalized channels, smooths values on Tick, applies configured Morph Targets, and broadcasts FCortanaRigAnimationState.
- FCortanaRigAnimationState: Blueprint-facing state, emotion, viseme, audio level, and smoothed channel map.

## Setup in the target UE5 project

1. Enable CortanaAvatarReceiver in the project and compile it against the project's exact Unreal Engine version.
2. Create a Data Asset using CortanaMetaHumanMappingAsset.
3. Add one rule for each Cortana channel used by the character.
4. Populate MorphTargetName only with names confirmed on the selected Skeletal Mesh. Leave it empty when routing that channel through Control Rig/Animation Blueprint instead.
5. Add CortanaAvatarReceiverComponent and CortanaMetaHumanRigComponent to the presentation Actor.
6. Assign Receiver, TargetMesh, and Mapping references in the component defaults.
7. Connect the receiver explicitly using the Stage 12.1 workflow.

## Animation Blueprint / Control Rig routing

Bind to OnAnimationStateUpdated from CortanaMetaHumanRigComponent. Copy the facial channel map and emotion/viseme/state/audio values into the Animation Blueprint's exposed variables or a project-owned animation data structure. In the AnimGraph:

- use the project's face animation layer / Control Rig node to apply the mapped facial controls;
- blend speech visemes with expression channels using the target rig's actual control semantics;
- keep body gestures on a separate locomotion/gesture layer;
- use the component's smoothed values as inputs, not raw network callbacks.

For direct Morph Target use, the adapter calls SetMorphTarget with the configured target name. For Control Rig, leave MorphTargetName empty and consume the event in Blueprint. This avoids assuming that generic channel names are identical to MetaHuman control names.

## Mapping semantics

mapped = clamp(source * Scale + Bias, 0, 1)

The runtime interpolates toward the mapped value using AttackSpeed when rising and ReleaseSpeed when falling. Set either speed to zero for immediate response. Values are bounded to [0, 1].

The receiver's frame timeout/disconnect emits a neutral frame. The rig component also returns its targets to the configured neutral value when no fresh frame is available. A production project should test facial neutral against its actual rig's authored neutral pose; some rigs use non-zero baselines or different value ranges and may require project-specific offsets.

## Acceptance criteria

- Plugin compiles in the exact target UE5 version.
- A mapping Data Asset is populated from the selected character's actual Morph Target / Control Rig inventory.
- Every used channel is verified visually on the target MetaHuman.
- Viseme and emotion blending is checked for mouth conflicts and clipping.
- Timeout, disconnect, reconnect, and neutral recovery are tested.
- Animation Blueprint / Control Rig update rate and latency are profiled during live speech.

## Verification boundary

Source-level implementation and documentation are present in this repository. UnrealBuildTool compilation, MetaHuman asset validation, and animation playback remain pending until the target Unreal project and character rig are supplied.
