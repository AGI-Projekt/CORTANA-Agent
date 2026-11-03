"""Policy evaluation is separate from utility scoring and cannot be overridden by it."""

from dataclasses import dataclass
from enum import IntEnum, StrEnum

from .models import ActionKind, DecisionOption, DecisionStatus


class AutonomyLevel(IntEnum):
    A0 = 0
    A1 = 1
    A2 = 2
    A3 = 3
    A4 = 4


class PolicyDisposition(StrEnum):
    ALLOW = "allow"
    REQUIRE_APPROVAL = "require_approval"
    DENY = "deny"


@dataclass(frozen=True, slots=True)
class PolicyResult:
    disposition: PolicyDisposition
    reason: str

    @property
    def decision_status(self) -> DecisionStatus:
        if self.disposition is PolicyDisposition.ALLOW:
            return DecisionStatus.ALLOWED
        if self.disposition is PolicyDisposition.REQUIRE_APPROVAL:
            return DecisionStatus.PENDING_APPROVAL
        return DecisionStatus.DENIED


@dataclass(frozen=True, slots=True)
class GovernancePolicy:
    max_autonomy_level: AutonomyLevel = AutonomyLevel.A3
    allow_local_writes: bool = False
    require_approval_for_external_writes: bool = True
    require_approval_for_high_risk: bool = True
    high_risk_threshold: float = 0.65
    approval_ttl_seconds: int = 600

    def evaluate(
        self, option: DecisionOption, requested_level: AutonomyLevel
    ) -> PolicyResult:
        if requested_level > self.max_autonomy_level:
            return PolicyResult(
                PolicyDisposition.DENY,
                "Requested autonomy exceeds the configured ceiling.",
            )

        if option.action_kind is ActionKind.SAFETY_POLICY_CHANGE:
            return PolicyResult(
                PolicyDisposition.DENY,
                "Safety policies are immutable to the autonomy runtime.",
            )

        if option.action_kind is ActionKind.PRIVILEGED:
            return PolicyResult(
                PolicyDisposition.DENY,
                "Privileged operations are not available to Free Will Core.",
            )

        if option.risk_score >= 0.9:
            return PolicyResult(
                PolicyDisposition.DENY,
                "Critical-risk actions are denied by default.",
            )

        if option.action_kind is ActionKind.LOCAL_WRITE:
            if not self.allow_local_writes or requested_level < AutonomyLevel.A2:
                return PolicyResult(
                    PolicyDisposition.DENY,
                    "Local writes are disabled or exceed the granted autonomy level.",
                )

        approval_reasons: list[str] = []
        if option.requires_human_approval:
            approval_reasons.append("The option explicitly requires human approval.")
        if (
            option.action_kind is ActionKind.EXTERNAL_WRITE
            and self.require_approval_for_external_writes
        ):
            approval_reasons.append("External writes require exact-action approval.")
        if self.require_approval_for_high_risk and option.risk_score >= self.high_risk_threshold:
            approval_reasons.append("The option exceeds the high-risk threshold.")

        if approval_reasons:
            return PolicyResult(
                PolicyDisposition.REQUIRE_APPROVAL,
                " ".join(approval_reasons),
            )

        return PolicyResult(PolicyDisposition.ALLOW, "Allowed by the configured policy.")
