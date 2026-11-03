"""Deterministic decision ranking; this module does not call models or execute tools."""

from uuid import uuid4

from .models import (
    DecisionContext,
    DecisionOption,
    DecisionRecord,
    DecisionStatus,
    Goal,
    ScoredOption,
)
from .policy import GovernancePolicy


WEIGHTS = {
    "goal_alignment": 0.25,
    "value_alignment": 0.20,
    "context_fit": 0.20,
    "long_term_impact": 0.15,
    "feasibility": 0.20,
}
RISK_PENALTY = 0.25


class DecisionEngine:
    def score(self, option: DecisionOption) -> float:
        weighted = sum(WEIGHTS[key] * option.scores[key] for key in WEIGHTS)
        return round(max(0.0, min(1.0, weighted - RISK_PENALTY * option.risk_score)), 6)

    def decide(
        self,
        context: DecisionContext,
        goal: Goal,
        options: tuple[DecisionOption, ...] | list[DecisionOption],
        policy: GovernancePolicy,
    ) -> DecisionRecord:
        if not options:
            raise ValueError("At least one decision option is required")
        if len({option.option_id for option in options}) != len(options):
            raise ValueError("Decision option IDs must be unique")

        evaluated = []
        for option in options:
            policy_result = policy.evaluate(option, context.autonomy_level)
            evaluated.append(
                ScoredOption(
                    option=option,
                    score=self.score(option),
                    policy_status=policy_result.decision_status,
                    policy_reason=policy_result.reason,
                )
            )
        evaluated.sort(key=lambda item: (-item.score, item.option.option_id))

        candidates = [
            item for item in evaluated
            if item.policy_status is not DecisionStatus.DENIED
        ]
        if not candidates:
            return DecisionRecord(
                decision_id=str(uuid4()),
                context_id=context.context_id,
                identity_id=context.identity_id,
                goal_id=goal.goal_id,
                selected_option_id=None,
                alternatives=tuple(evaluated),
                status=DecisionStatus.DENIED,
                score=None,
                approval_required=False,
                reason="No option passed governance policy.",
            )

        selected = candidates[0]
        pending = selected.policy_status is DecisionStatus.PENDING_APPROVAL
        return DecisionRecord(
            decision_id=str(uuid4()),
            context_id=context.context_id,
            identity_id=context.identity_id,
            goal_id=goal.goal_id,
            selected_option_id=selected.option.option_id,
            alternatives=tuple(item for item in evaluated if item is not selected),
            status=(
                DecisionStatus.PENDING_APPROVAL if pending else DecisionStatus.ALLOWED
            ),
            score=selected.score,
            approval_required=pending,
            reason=selected.policy_reason,
        )
