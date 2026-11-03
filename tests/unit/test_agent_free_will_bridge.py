from cortana.core import CortanaAgent
from cortana.free_will_bridge import CEMContextEnvelope, CEMFreeWillBridge
from cortana_free_will import ActionKind, DecisionOption, DecisionStatus, Goal


def test_agent_exposes_explicit_governed_autonomy_bridge():
    agent = CortanaAgent(free_will_bridge=CEMFreeWillBridge())
    envelope = CEMContextEnvelope(
        context_id="ctx-agent-1",
        identity_id="cortana-primary",
        session_id="session-agent-1",
        cem_version="6.2.0",
    )
    option = DecisionOption(
        option_id="inspect",
        description="Inspect current project state",
        action_kind=ActionKind.READ_ONLY,
        scores={
            "goal_alignment": 0.9,
            "value_alignment": 0.9,
            "context_fit": 0.9,
            "long_term_impact": 0.8,
            "feasibility": 0.9,
        },
        risk_score=0.05,
    )
    result = agent.propose_autonomous_decision(
        envelope, Goal("goal-agent-1", "Review project"), [option]
    )
    assert result.status is DecisionStatus.ALLOWED
    assert result.selected_option_id == "inspect"


def test_agent_requires_explicit_bridge_configuration():
    agent = CortanaAgent()
    envelope = CEMContextEnvelope(
        context_id="ctx-agent-2",
        identity_id="cortana-primary",
        session_id="session-agent-2",
        cem_version="6.2.0",
    )
    try:
        agent.propose_autonomous_decision(
            envelope, Goal("goal-agent-2", "Review project"), []
        )
    except RuntimeError as exc:
        assert "bridge is not configured" in str(exc)
    else:
        raise AssertionError("Expected an explicit configuration error")
