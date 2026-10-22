"""Stable request/response contracts shared by Cortana components."""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

@dataclass(frozen=True, slots=True)
class Message:
    role: str
    content: str
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: dict[str, Any] = field(default_factory=dict)
    def __post_init__(self) -> None:
        if not self.role.strip(): raise ValueError("role must not be empty")
        if not isinstance(self.content, str): raise TypeError("content must be a string")

@dataclass(frozen=True, slots=True)
class AgentRequest:
    text: str
    session_id: str = field(default_factory=lambda: str(uuid4()))
    metadata: dict[str, Any] = field(default_factory=dict)
    def __post_init__(self) -> None:
        if not self.text.strip(): raise ValueError("text must not be empty")
        if not self.session_id.strip(): raise ValueError("session_id must not be empty")

@dataclass(frozen=True, slots=True)
class AgentResponse:
    text: str
    request_id: str
    status: str = "ok"
    metadata: dict[str, Any] = field(default_factory=dict)
