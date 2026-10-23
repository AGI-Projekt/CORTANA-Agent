"""Privacy-preserving, bounded audit trail for operational events."""
from __future__ import annotations
import json
import logging
from collections import Counter, deque
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from threading import Lock
from typing import Literal

AuditEvent = Literal["realtime_session", "realtime_emotion"]
AuditOutcome = Literal["success", "failed", "disabled", "unavailable", "invalid_response", "adjusted", "neutral"]


@dataclass(frozen=True, slots=True)
class AuditRecord:
    occurred_at: str
    event: str
    outcome: str
    duration_ms: int


class PrivacyAuditLog:
    """Bounded in-process audit records containing no user content or identifiers."""

    _EVENTS = frozenset({"realtime_session", "realtime_emotion"})
    _OUTCOMES = frozenset({
        "success", "failed", "disabled", "unavailable", "invalid_response", "adjusted", "neutral",
    })

    def __init__(self, capacity: int = 512, logger: logging.Logger | None = None) -> None:
        if capacity < 1:
            raise ValueError("capacity must be >= 1")
        self._records: deque[AuditRecord] = deque(maxlen=capacity)
        self._lock = Lock()
        self._logger = logger or logging.getLogger("cortana.audit")

    def record(self, event: str, outcome: str, duration_ms: int = 0) -> AuditRecord:
        if event not in self._EVENTS:
            raise ValueError("unsupported audit event")
        if outcome not in self._OUTCOMES:
            raise ValueError("unsupported audit outcome")
        item = AuditRecord(
            occurred_at=datetime.now(timezone.utc).isoformat(),
            event=event,
            outcome=outcome,
            duration_ms=max(0, int(duration_ms)),
        )
        with self._lock:
            self._records.append(item)
        self._logger.info("%s", json.dumps(asdict(item), separators=(",", ":"), ensure_ascii=False))
        return item

    def snapshot(self) -> tuple[dict[str, object], ...]:
        with self._lock:
            return tuple(asdict(item) for item in self._records)

    def summary(self) -> dict[str, dict[str, int]]:
        with self._lock:
            counts = Counter((item.event, item.outcome) for item in self._records)
        return {
            event: {
                outcome: count
                for (recorded_event, outcome), count in counts.items()
                if recorded_event == event
            }
            for event in sorted(self._EVENTS)
        }
