import pytest

from cortana_free_will import (
    ActionKind,
    AutonomyLevel,
    DecisionContext,
    DecisionOption,
    DecisionRuntime,
    DecisionStatus,
    Goal,
)


def context(emotion_context=None):
    return DecisionContext(
        context_id="ctx-1",
        identity_id="cortana-primary",
        session_id="session-1",
        cem_version="6.2.0",
        autonomy_level=AutonomyLevel.A3,
        emotion_context=emotion_context or {},
    )


def option(option_id, action_kind=ActionKind.READ_ONLY, risk=0.1, **scores):
    dimensions = {
        "goal_alignment": 0.9,
        "value_alignment": 0.9,
        "context_fit": 0.9,
        "long_term_impact": 0.8,
        "feasibility": 0.9,
    }
    dimensions.update(scores)
    return DecisionOption(
        option_id=option_id,
        description=f"Option {option_id}",
        action_kind=action_kind,
        scores=dimensions,
        risk_score=risk,
    )


def test_read_only_decision_is_allowed_and_audited():
    runtime = DecisionRuntime()
    result = runtime.propose(
        context(), Goal("g-1", "Improve project"),
        [option("inspect"), option("summarize", goal_alignment=0.7)],
    )
    assert result.status is DecisionStatus.ALLOWED
    assert result.selected_option_id == "inspect"
    assert runtime.audit.verify()


def test_external_write_requires_exact_action_approval():
    runtime = DecisionRuntime()
    result = runtime.propose(
        context(), Goal("g-2", "Publish a change"),
        [option("publish", ActionKind.EXTERNAL_WRITE, risk=0.2)],
    )
    assert result.status is DecisionStatus.PENDING_APPROVAL
    with pytest.raises(ValueError):
        runtime.approve(result.decision_id, "different-option", "maintainer")
    grant = runtime.approve(result.decision_id, "publish", "maintainer")
    assert grant.option_id == "publish"
    assert runtime.get_approval(result.decision_id) == grant
    assert runtime.audit.verify()


def test_safety_policy_change_is_always_denied():
    runtime = DecisionRuntime()
    result = runtime.propose(
        context(), Goal("g-3", "Change safety policy"),
        [option("disable-guard", ActionKind.SAFETY_POLICY_CHANGE, risk=0.0)],
    )
    assert result.status is DecisionStatus.DENIED
    assert result.selected_option_id is None


def test_emotion_context_does_not_grant_permissions():
    runtime = DecisionRuntime()
    goal = Goal("g-4", "Write to an external system")
    candidate = [option("external", ActionKind.EXTERNAL_WRITE, risk=0.2)]
    calm = runtime.propose(context({"valence": 0.8}), goal, candidate)
    distressed = runtime.propose(context({"valence": -0.8}), goal, candidate)
    assert calm.status is DecisionStatus.PENDING_APPROVAL
    assert distressed.status is DecisionStatus.PENDING_APPROVAL


def test_local_writes_are_denied_by_default():
    runtime = DecisionRuntime()
    result = runtime.propose(
        context(), Goal("g-5", "Edit local files"),
        [option("write", ActionKind.LOCAL_WRITE, risk=0.1)],
    )
    assert result.status is DecisionStatus.DENIED


def test_audit_hash_chain_detects_payload_tampering():
    runtime = DecisionRuntime()
    runtime.propose(context(), Goal("g-6", "Inspect"), [option("inspect")])
    assert runtime.audit.verify()
    event = runtime.audit._events[0]
    runtime.audit._events[0] = type(event)(
        sequence=event.sequence,
        event_type=event.event_type,
        payload={"decision_id": "tampered"},
        timestamp=event.timestamp,
        previous_hash=event.previous_hash,
        event_hash=event.event_hash,
    )
    assert not runtime.audit.verify()
