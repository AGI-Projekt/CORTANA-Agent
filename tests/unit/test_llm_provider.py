from types import SimpleNamespace
import pytest
from cortana.core.contracts import Message
from cortana.llm.openai_responses import OpenAIResponsesModel

class FakeResponses:
    def __init__(self, output_text="Cześć!"):
        self.output_text = output_text
        self.calls = []
    def create(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(output_text=self.output_text)

class FakeClient:
    def __init__(self, output_text="Cześć!"):
        self.responses = FakeResponses(output_text)

def test_responses_adapter_sends_history_in_order_and_disables_remote_storage():
    client = FakeClient("Witaj ponownie!")
    model = OpenAIResponsesModel(model="test-model", client=client)
    history = (
        Message("user", "Pierwsze pytanie"),
        Message("assistant", "Pierwsza odpowiedź"),
        Message("system", "This role must not be forwarded"),
    )
    result = model.generate("Drugie pytanie", instructions="Jesteś Cortaną.", history=history)
    assert result == "Witaj ponownie!"
    call = client.responses.calls[0]
    assert call["model"] == "test-model"
    assert call["instructions"] == "Jesteś Cortaną."
    assert call["store"] is False
    assert call["input"] == [
        {"role": "user", "content": "Pierwsze pytanie"},
        {"role": "assistant", "content": "Pierwsza odpowiedź"},
        {"role": "user", "content": "Drugie pytanie"},
    ]

def test_responses_adapter_rejects_blank_prompt():
    model = OpenAIResponsesModel(client=FakeClient())
    with pytest.raises(ValueError, match="prompt"):
        model.generate("  ")

def test_responses_adapter_rejects_missing_text_output():
    model = OpenAIResponsesModel(client=FakeClient("  "))
    with pytest.raises(RuntimeError, match="no text output"):
        model.generate("Hello")

def test_provider_requires_credentials_or_explicit_local_endpoint(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("CORTANA_LLM_API_KEY", raising=False)
    monkeypatch.delenv("CORTANA_LLM_BASE_URL", raising=False)
    with pytest.raises(ValueError, match="No API key configured"):
        OpenAIResponsesModel()
