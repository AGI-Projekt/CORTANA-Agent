"""Stable contract between Cortana and an Emotion Core provider.

This module defines data shapes and validation only. It does not infer emotions,
persist input, call models, or grant permissions.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import StrEnum
from typing import Protocol


class EmotionModality(StrEnum):
    """Input modality presented to an emotion provider."""

    TEXT = "text"
    AUDIO = "audio"
    VISION = "vision"
    MULTIMODAL = "multimodal"


class EmotionCategory(StrEnum):
    """Portable emotion labels; providers may map their private labels to these."""

    UNKNOWN = "unknown"
    NEUTRAL = "neutral"
    JOY = "joy"
    SADNESS = "sadness"
    FRUSTRATION = "frustration"
    ANGER = "anger"
    FEAR = "fear"
    ANXIETY = "anxiety"
    SURPRISE = "surprise"
    CURIOSITY = "curiosity"
    INTEREST = "interest"
    BOREDOM = "boredom"
    RELIEF = "relief"
    TRUST = "trust"
    GRATITUDE = "gratitude"


@dataclass(frozen=True, slots=True)
class EmotionRequest:
    """Short-lived input envelope for emotion analysis.

    Prefer feature references over raw media. Callers are responsible for consent,
    minimization, access control, and retention before constructing this object.
    """

    request_id: str
    source_ref: str
    modality: EmotionModality
    observed_at: datetime
    text: str | None = None
    transcript: str | None = None
    audio_feature_ref: str | None = None
    visual_feature_ref: str | None = None
    context_summary: str | None = None

    def __post_init__(self) -> None:
        if not self.request_id.strip():
            raise ValueError("request_id must not be empty")
        if not self.source_ref.strip():
            raise ValueError("source_ref must not be empty")
        _require_aware_datetime(self.observed_at, "observed_at")
        if not any(
            value and value.strip()
            for value in (
                self.text,
                self.transcript,
                self.audio_feature_ref,
                self.visual_feature_ref,
            )
        ):
            raise ValueError(
                "at least one signal field must be provided; context alone is insufficient"
            )


@dataclass(frozen=True, slots=True)
class EmotionEstimate:
    """A probabilistic computational estimate, not a statement of inner experience."""

    request_id: str
    category: EmotionCategory
    valence: float
    arousal: float
    intensity: float
    confidence: float
    model_version: str
    evidence_refs: tuple[str, ...] = ()
    ambiguities: tuple[str, ...] = ()
    estimated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self) -> None:
        if not self.request_id.strip():
            raise ValueError("request_id must not be empty")
        if not self.model_version.strip():
            raise ValueError("model_version must not be empty")
        if not isinstance(self.category, EmotionCategory):
            raise TypeError("category must be an EmotionCategory")
        _require_range(self.valence, -1.0, 1.0, "valence")
        _require_range(self.arousal, 0.0, 1.0, "arousal")
        _require_range(self.intensity, 0.0, 1.0, "intensity")
        _require_range(self.confidence, 0.0, 1.0, "confidence")
        _require_aware_datetime(self.estimated_at, "estimated_at")
        if any(not item.strip() for item in self.evidence_refs):
            raise ValueError("evidence_refs must not contain empty references")
        if any(not item.strip() for item in self.ambiguities):
            raise ValueError("ambiguities must not contain empty strings")

    @property
    def may_adjust_tone(self) -> bool:
        """Whether this estimate may influence presentation style.

        The default threshold is conservative and configurable at the integration
        layer. This property never authorizes a tool or changes a security policy.
        """
        return self.category is not EmotionCategory.UNKNOWN and self.confidence >= 0.75

    @property
    def is_low_confidence(self) -> bool:
        """Whether the estimate is below the default category interpretation threshold."""
        return self.confidence < 0.50


class EmotionProvider(Protocol):
    """Adapter contract implemented by local or remote Emotion Core providers."""

    def analyze(self, request: EmotionRequest) -> EmotionEstimate:
        """Return an estimate correlated to the request, without persisting its input."""
        ...


def _require_range(value: float, minimum: float, maximum: float, field_name: str) -> None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise TypeError(f"{field_name} must be numeric")
    if not minimum <= value <= maximum:
        raise ValueError(f"{field_name} must be in range [{minimum}, {maximum}]")


def _require_aware_datetime(value: datetime, field_name: str) -> None:
    if not isinstance(value, datetime):
        raise TypeError(f"{field_name} must be a datetime")
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field_name} must include a timezone")
