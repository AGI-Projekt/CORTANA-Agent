# CORTANA FREE WILL CORE ∞

Version 1.0.0 — governed autonomy package.

This is a separable Python package intended to be installable independently and
integrated into CORTANA-Agent through an adapter. It implements bounded decision
ranking, goal metadata, policy evaluation, exact-action approval records, and a
tamper-evident in-memory audit ledger.

## Important boundary

This package proposes and authorizes decisions; it does not execute tools, modify
the host, grant itself permissions, rewrite its code, or establish that an AI has
subjective consciousness or metaphysical free will.

Default policy:
- autonomy ceiling: A3;
- read-only decisions may be allowed;
- local writes are disabled by default;
- external writes require an exact, expiring human approval;
- privileged operations and safety-policy changes are always denied;
- emotion metadata is contextual only and never grants permissions.

## Install

From the repository root:

    python -m pip install -e "packages/cortana-free-will-core[test]"

## Minimal use

    from cortana_free_will import (
        ActionKind, AutonomyLevel, DecisionContext, DecisionOption,
        DecisionRuntime, Goal, GovernancePolicy,
    )

    runtime = DecisionRuntime(GovernancePolicy())
    context = DecisionContext(
        context_id="ctx-001",
        identity_id="cortana-primary",
        session_id="session-001",
        cem_version="6.2.0",
        autonomy_level=AutonomyLevel.A3,
    )
    goal = Goal("goal-001", "Improve the project architecture", "development")
    options = [
        DecisionOption(
            option_id="inspect",
            description="Inspect current architecture and report findings",
            action_kind=ActionKind.READ_ONLY,
            scores={
                "goal_alignment": 0.9,
                "value_alignment": 0.95,
                "context_fit": 0.9,
                "long_term_impact": 0.7,
                "feasibility": 1.0,
            },
            risk_score=0.05,
        )
    ]
    decision = runtime.propose(context, goal, options)

The returned decision is a proposal only. An execution adapter must separately
enforce the same policy at the point of action. No execution adapter is included
in v1.0.0.

## Development

    python -m pip install -e ".[test]"
    pytest

The package can be split into its own Git repository without changing its Python
package name or import path.
