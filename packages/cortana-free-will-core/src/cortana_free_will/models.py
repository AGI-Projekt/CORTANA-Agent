"""Immutable data contracts for decisions; no execution capability is exposed."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import StrEnum
from typing import Mapping


class ActionKind(StrEnum):
    READ_ONLY = "read_only"
    LOCAL_WRITE = "local_write"
    EXTERNAL_WRITE = "external_write"
    PRIVILEGED = "privileged"
    SAFETY_POLICY_CHANGE = "safety_policy_change"


class DecisionStatus(StrEnum):
    ALLOWED = "allowed"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    DENIED = "denied"


@dataclass(frozen=True, slots=True)
class Goal:
    goal_id: str
    description: str
    category: str = "cooperative"

    def __post_init__(self) -> None:
        if not self.goal_id.strip() or not self.description.strip():
            raise ValueError("goal_id and description are required")


@dataclass(frozen=True, slots=True)
class DecisionContext:
    context_id: str
    identity_id: str
    session_id: str
    cem_version: str
    autonomy_level: "AutonomyLevel"
    emotion_context: Mapping[str, str | float] = field(default_factory=dict)
    metadata: Mapping[str, str | float | bool] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self) -> None:
        for name in ("context_id", "identity_id", "session_id", "cem_version"):
            if not getattr(self, name).strip():
                raise ValueError(f"{name} is required")
        # Emotion metadata is deliberately not interpreted as authorization.


@dataclass(frozen=True, slots=True)
class DecisionOption:
    option_id: str
    description: str
    action_kind: ActionKind
    scores: Mapping[str, float]
    risk_score: float = 0.0
    requires_human_approval: bool = False

    def __post_init__(self) -> None:
        if not self.option_id.strip() or not self.description.strip():
            raise ValueError("option_id and description are required")
        if not 0.0 <= self.risk_score <= 1.0:
            raise ValueError("risk_score must be between 0 and 1")
        required = {
            "goal_alignment",
            "value_alignment",
            "context_fit",
            "long_term_impact",
            "feasibility",
        }
        if set(self.scores) != required:
            raise ValueError(f"scores must contain exactly: {sorted(required)}")
        if any(not 0.0 <= float(value) <= 1.0 for value in self.scores.values()):
            raise ValueError("all score dimensions must be between 0 and 1")


@dataclass(frozen=True, slots=True)
class ScoredOption:
    option: DecisionOption
    score: float
    policy_status: DecisionStatus
    policy_reason: str


@dataclass(frozen=True, slots=True)
class DecisionRecord:
    decision_id: str
    context_id: str
    identity_id: str
    goal_id: str
    selected_option_id: str | None
    alternatives: tuple[ScoredOption, ...]
    status: DecisionStatus
    score: float | None
    approval_required: bool
    reason: str
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
