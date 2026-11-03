"""Append-only, hash-chained audit ledger for local development and tests."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
import hashlib
import json
from typing import Mapping


@dataclass(frozen=True, slots=True)
class AuditEvent:
    sequence: int
    event_type: str
    payload: Mapping[str, str | float | int | bool | None]
    timestamp: datetime
    previous_hash: str
    event_hash: str


class InMemoryAuditLedger:
    """In-memory reference ledger; production deployments need durable storage."""

    def __init__(self) -> None:
        self._events: list[AuditEvent] = []

    @property
    def events(self) -> tuple[AuditEvent, ...]:
        return tuple(self._events)

    def append(
        self, event_type: str, payload: Mapping[str, str | float | int | bool | None]
    ) -> AuditEvent:
        timestamp = datetime.now(timezone.utc)
        previous_hash = self._events[-1].event_hash if self._events else "GENESIS"
        body = {
            "sequence": len(self._events) + 1,
            "event_type": event_type,
            "payload": dict(payload),
            "timestamp": timestamp.isoformat(),
            "previous_hash": previous_hash,
        }
        canonical = json.dumps(body, sort_keys=True, separators=(",", ":"))
        event_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        event = AuditEvent(
            sequence=body["sequence"],
            event_type=event_type,
            payload=dict(payload),
            timestamp=timestamp,
            previous_hash=previous_hash,
            event_hash=event_hash,
        )
        self._events.append(event)
        return event

    def verify(self) -> bool:
        previous_hash = "GENESIS"
        for expected_sequence, event in enumerate(self._events, start=1):
            if event.sequence != expected_sequence or event.previous_hash != previous_hash:
                return False
            body = {
                "sequence": event.sequence,
                "event_type": event.event_type,
                "payload": dict(event.payload),
                "timestamp": event.timestamp.isoformat(),
                "previous_hash": event.previous_hash,
            }
            canonical = json.dumps(body, sort_keys=True, separators=(",", ":"))
            expected_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
            if event.event_hash != expected_hash:
                return False
            previous_hash = event.event_hash
        return True
