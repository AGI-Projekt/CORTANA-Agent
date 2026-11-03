# CORTANA FREE WILL CORE ∞ — CEM Integration

Package: cortana-free-will-core  
Version: 1.0.0  
Target baseline: CORTANA-Agent repository; CEM∞ 6.2.0 is an integration target
supplied by project context, not a verified installed dependency.

## Deployment shape

The autonomy engine is maintained as a separable package under
packages/cortana-free-will-core/. The CORTANA-Agent adapter is
src/cortana/free_will_bridge.py. This directory layout is split-ready for a
future dedicated Git repository. The current GitHub integration does not create
repositories, so no second remote repository is claimed.

## Responsibilities

- CEM supplies normalized identity, session, memory references, emotion metadata,
  prediction metadata, and version identifiers.
- Free Will Core ranks candidate options and evaluates them against an independent
  governance policy.
- The adapter translates the explicit CEM envelope to the standalone package.
- The selected option remains a proposal. A separate execution adapter must
  re-check authorization at the point of execution.

## Non-negotiable boundaries

1. Emotion, memory, prediction, and identity data are context, not authority.
2. Emotion metadata cannot alter permissions.
3. External writes require approval bound to one decision ID and one option ID.
4. Privileged operations and safety-policy changes are denied.
5. Local writes are disabled by default.
6. The package does not execute tools or modify its own code.
7. The default autonomy ceiling is A3.
8. The in-memory audit ledger is a development reference only; production must
   use durable, access-controlled, append-only storage.

## Install

    python -m pip install -e "packages/cortana-free-will-core[test]"

## Integration

Construct CEMContextEnvelope from verified CEM adapters and pass a Goal plus
candidate DecisionOption values to CEMFreeWillBridge.propose. Do not pass raw
audio, video, or unfiltered transcripts into the decision ledger. Use references
or minimized derived metadata.

## Verification status

The package includes unit tests for deterministic ranking, governance denial,
exact-action approval, emotion/permission separation, and audit integrity.
Tests have not been executed by this GitHub write operation. CI must run them
before merge or release.


## CortanaAgent integration

After installing the package, inject the bridge explicitly:

    from cortana.core import CortanaAgent
    from cortana.free_will_bridge import CEMContextEnvelope, CEMFreeWillBridge

    agent = CortanaAgent(free_will_bridge=CEMFreeWillBridge())
    envelope = CEMContextEnvelope(
        context_id="ctx-001",
        identity_id="cortana-primary",
        session_id="session-001",
        cem_version="6.2.0",
        autonomy_level="A3",
    )
    decision = agent.propose_autonomous_decision(envelope, goal, options)

This is an explicit proposal API; ordinary chat responses do not trigger autonomous
actions. The selected action must be separately authorized and executed by a
reviewed adapter. A missing bridge raises a configuration error instead of
silently bypassing governance.
