"""Governed runtime. Approval authorizes one proposal; this runtime never executes it."""

from dataclasses import dataclass, replace
from datetime import datetime, timedelta, timezone

from .audit import InMemoryAuditLedger
from .engine import DecisionEngine
from .models import (
    DecisionContext,
    DecisionOption,
    DecisionRecord,
    DecisionStatus,
    Goal,
)
from .policy import GovernancePolicy


class ApprovalError(ValueError):
    """Raised when an approval does not match a live pending decision."""


@dataclass(frozen=True, slots=True)
class ApprovalGrant:
    decision_id: str
    option_id: str
    approver_id: str
    approved_at: datetime
    expires_at: datetime


class DecisionRuntime:
    def __init__(
        self,
        policy: GovernancePolicy | None = None,
        engine: DecisionEngine | None = None,
        audit: InMemoryAuditLedger | None = None,
    ) -> None:
        self.policy = policy or GovernancePolicy()
        self.engine = engine or DecisionEngine()
        self.audit = audit or InMemoryAuditLedger()
        self._decisions: dict[str, DecisionRecord] = {}
        self._approvals: dict[str, ApprovalGrant] = {}

    def propose(
        self,
        context: DecisionContext,
        goal: Goal,
        options: tuple[DecisionOption, ...] | list[DecisionOption],
    ) -> DecisionRecord:
        decision = self.engine.decide(context, goal, options, self.policy)
        self._decisions[decision.decision_id] = decision
        self.audit.append(
            "decision.proposed",
            {
                "decision_id": decision.decision_id,
                "context_id": decision.context_id,
                "identity_id": decision.identity_id,
                "goal_id": decision.goal_id,
                "selected_option_id": decision.selected_option_id,
                "status": decision.status.value,
                "approval_required": decision.approval_required,
            },
        )
        return decision

    def approve(
        self, decision_id: str, option_id: str, approver_id: str
    ) -> ApprovalGrant:
        decision = self._decisions.get(decision_id)
        if decision is None:
            raise ApprovalError("Unknown decision.")
        if decision.status is not DecisionStatus.PENDING_APPROVAL:
            raise ApprovalError("Decision is not awaiting approval.")
        if decision.selected_option_id != option_id:
            raise ApprovalError("Approval must match the exact selected option.")
        if not approver_id.strip():
            raise ApprovalError("approver_id is required.")

        now = datetime.now(timezone.utc)
        grant = ApprovalGrant(
            decision_id=decision_id,
            option_id=option_id,
            approver_id=approver_id,
            approved_at=now,
            expires_at=now + timedelta(seconds=self.policy.approval_ttl_seconds),
        )
        self._approvals[decision_id] = grant
        self._decisions[decision_id] = replace(
            decision,
            status=DecisionStatus.APPROVED,
            approval_required=False,
            reason=f"Approved by {approver_id}; execution remains a separate operation.",
        )
        self.audit.append(
            "decision.approved",
            {
                "decision_id": decision_id,
                "option_id": option_id,
                "approver_id": approver_id,
                "expires_at": grant.expires_at.isoformat(),
            },
        )
        return grant

    def get_approval(self, decision_id: str) -> ApprovalGrant | None:
        grant = self._approvals.get(decision_id)
        if grant is None or datetime.now(timezone.utc) >= grant.expires_at:
            return None
        return grant

    def get_decision(self, decision_id: str) -> DecisionRecord | None:
        return self._decisions.get(decision_id)
