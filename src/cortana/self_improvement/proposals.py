"""Auditable self-improvement proposals. This module never executes generated code."""
from __future__ import annotations
import json, re
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

@dataclass(frozen=True, slots=True)
class ImprovementProposal:
    title: str
    problem: str
    proposed_change: str
    acceptance_criteria: tuple[str, ...]
    risk_level: str = "low"
    proposal_id: str = ""
    created_at: str = ""
    def __post_init__(self) -> None:
        if not self.title.strip() or not self.problem.strip() or not self.proposed_change.strip(): raise ValueError("title, problem and proposed_change are required")
        if not self.acceptance_criteria or any(not item.strip() for item in self.acceptance_criteria): raise ValueError("acceptance_criteria must contain non-empty criteria")
        if self.risk_level not in {"low", "medium", "high"}: raise ValueError("risk_level must be low, medium, or high")
        if not self.proposal_id: object.__setattr__(self, "proposal_id", str(uuid4()))
        if not self.created_at: object.__setattr__(self, "created_at", datetime.now(timezone.utc).isoformat())

class ProposalStore:
    """Store proposals as JSON data; never import or execute the payload."""
    def __init__(self, root: str | Path) -> None: self.root = Path(root).resolve()
    def save(self, proposal: ImprovementProposal) -> Path:
        self.root.mkdir(parents=True, exist_ok=True)
        safe_id = re.sub(r"[^a-zA-Z0-9_-]", "", proposal.proposal_id)
        if not safe_id: raise ValueError("proposal_id does not contain safe filename characters")
        destination = (self.root / f"{safe_id}.json").resolve()
        if destination.parent != self.root: raise ValueError("proposal path escaped proposal directory")
        temporary = destination.with_suffix(".json.tmp")
        temporary.write_text(json.dumps(asdict(proposal), indent=2, ensure_ascii=False) + "\\n", encoding="utf-8")
        temporary.replace(destination)
        return destination
    def list(self) -> tuple[dict[str, object], ...]:
        if not self.root.exists(): return ()
        results: list[dict[str, object]] = []
        for path in sorted(self.root.glob("*.json")):
            payload = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(payload, dict): results.append(payload)
        return tuple(results)
