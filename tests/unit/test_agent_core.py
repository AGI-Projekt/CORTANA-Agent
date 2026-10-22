from datetime import datetime, timedelta, timezone
import pytest
from cortana.core import AgentRequest, CortanaAgent, Message
from cortana.memory import ConversationMemory, MemoryPolicy
from cortana.self_improvement import ImprovementProposal, ProposalStore
from cortana.tools import Tool, ToolRegistry

def test_echo_agent_returns_correlated_response():
    response = CortanaAgent().respond(AgentRequest("Witaj", session_id="session-1"))
    assert response.text == "Rozumiem: Witaj"
    assert response.request_id == "session-1"

def test_empty_request_is_rejected():
    with pytest.raises(ValueError): AgentRequest("   ")

def test_tool_requires_allowlist_and_required_arguments():
    registry = ToolRegistry(allowed_tools={"sum"})
    registry.register(Tool("sum", lambda args: args["a"] + args["b"], frozenset({"a", "b"})))
    assert registry.invoke("sum", {"a": 2, "b": 3}) == 5
    with pytest.raises(PermissionError): registry.invoke("shell", {})
    with pytest.raises(ValueError): registry.invoke("sum", {"a": 1})

def test_memory_is_bounded_and_clearable():
    memory = ConversationMemory(MemoryPolicy(max_messages=2, retention_days=7))
    for n in range(3): memory.add(Message("user", str(n)))
    assert [m.content for m in memory.list_messages()] == ["1", "2"]
    memory.clear()
    assert memory.list_messages() == ()

def test_memory_purges_expired_messages():
    memory = ConversationMemory(MemoryPolicy(retention_days=1))
    old = Message("user", "expired", datetime.now(timezone.utc) - timedelta(days=2))
    memory.add(old)
    assert memory.list_messages() == ()

def test_improvement_proposals_are_saved_as_data(tmp_path):
    store = ProposalStore(tmp_path / "proposals")
    proposal = ImprovementProposal(title="Improve tests", problem="A path lacks regression coverage.", proposed_change="Add a deterministic regression test.", acceptance_criteria=("New test passes", "No existing tests regress"))
    path = store.save(proposal)
    assert path.exists()
    stored = store.list()
    assert len(stored) == 1
    assert stored[0]["title"] == "Improve tests"
