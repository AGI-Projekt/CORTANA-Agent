"""Volatile conversation memory with explicit retention and deletion."""
from __future__ import annotations
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from cortana.core.contracts import Message

@dataclass(frozen=True, slots=True)
class MemoryPolicy:
    max_messages: int = 100
    retention_days: int = 7
    def __post_init__(self) -> None:
        if self.max_messages < 1: raise ValueError("max_messages must be >= 1")
        if self.retention_days < 1: raise ValueError("retention_days must be >= 1")

class ConversationMemory:
    """In-memory by design: process exit clears data; nothing is persisted to disk."""
    def __init__(self, policy: MemoryPolicy | None = None) -> None:
        self.policy = policy or MemoryPolicy()
        self._messages: deque[Message] = deque(maxlen=self.policy.max_messages)
    def add(self, message: Message) -> None:
        self._purge_expired()
        self._messages.append(message)
    def list_messages(self) -> tuple[Message, ...]:
        self._purge_expired()
        return tuple(self._messages)
    def clear(self) -> None: self._messages.clear()
    def _purge_expired(self) -> None:
        cutoff = datetime.now(timezone.utc) - timedelta(days=self.policy.retention_days)
        self._messages = deque((m for m in self._messages if _as_utc(m.timestamp) >= cutoff), maxlen=self.policy.max_messages)

def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None: return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
