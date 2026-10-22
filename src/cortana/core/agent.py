"""Minimal deterministic agent orchestration; provider adapters can implement LanguageModel."""
from __future__ import annotations
from typing import Protocol
from .contracts import AgentRequest, AgentResponse

class LanguageModel(Protocol):
    def generate(self, prompt: str) -> str: ...

class EchoModel:
    """Safe offline starter model; replace using an explicit provider adapter."""
    def generate(self, prompt: str) -> str:
        return f"Rozumiem: {prompt}"

class CortanaAgent:
    def __init__(self, model: LanguageModel | None = None) -> None:
        self._model = model or EchoModel()
    def respond(self, request: AgentRequest) -> AgentResponse:
        result = self._model.generate(request.text)
        if not isinstance(result, str): raise TypeError("model provider must return a string")
        return AgentResponse(text=result, request_id=request.session_id)
