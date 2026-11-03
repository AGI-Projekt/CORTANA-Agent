"""Optional adapter boundary between CORTANA-Agent and cortana-free-will-core.

Install the separable package with:
    python -m pip install -e packages/cortana-free-will-core

The bridge receives normalized CEM context. It does not introspect private CEM
internals, grant permissions, or execute the selected action.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping, Sequence

from cortana_free_will import (
    AutonomyLevel,
    DecisionContext,
    DecisionOption,
    DecisionRecord,
    DecisionRuntime,
    Goal,
)


@dataclass(frozen=True, slots=True)
class CEMContextEnvelope:
    context_id: str
    identity_id: str
    session_id: str
    cem_version: str
    autonomy_level: str = "A3"
    emotion_context: Mapping[str, str | float] | None = None
    metadata: Mapping[str, str | float | bool] | None = None


class CEMFreeWillBridge:
    """Maps an explicit CEM envelope to the standalone decision runtime."""

    def __init__(self, runtime: DecisionRuntime | None = None) -> None:
        self.runtime = runtime or DecisionRuntime()

    def propose(
        self,
        envelope: CEMContextEnvelope,
        goal: Goal,
        options: Sequence[DecisionOption],
    ) -> DecisionRecord:
        try:
            level = AutonomyLevel[envelope.autonomy_level]
        except KeyError as exc:
            raise ValueError("Unsupported autonomy level") from exc

        context = DecisionContext(
            context_id=envelope.context_id,
            identity_id=envelope.identity_id,
            session_id=envelope.session_id,
            cem_version=envelope.cem_version,
            autonomy_level=level,
            emotion_context=envelope.emotion_context or {},
            metadata=envelope.metadata or {},
        )
        return self.runtime.propose(context, goal, list(options))
