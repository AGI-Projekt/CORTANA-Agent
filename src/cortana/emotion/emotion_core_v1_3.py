"""Adapter from the standalone Emotion Core 1.3 prototype to Cortana's contract.

The prototype is loaded lazily and is not vendored into this repository. Its package
root must be on PYTHONPATH, or a compatible core and input factory can be injected.
The upstream implementation currently analyzes text with lexical heuristics only.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Callable

from cortana.emotion.contracts import (
    EmotionCategory,
    EmotionEstimate,
    EmotionModality,
    EmotionRequest,
)

_CATEGORY_MAP: dict[str, EmotionCategory] = {
    "neutral": EmotionCategory.NEUTRAL,
    "joy": EmotionCategory.JOY,
    "sadness": EmotionCategory.SADNESS,
    "frustration": EmotionCategory.FRUSTRATION,
    "anger": EmotionCategory.ANGER,
    "fear": EmotionCategory.FEAR,
    "anxiety": EmotionCategory.ANXIETY,
    "surprise": EmotionCategory.SURPRISE,
    "curiosity": EmotionCategory.CURIOSITY,
    "boredom": EmotionCategory.BOREDOM,
    "relief": EmotionCategory.RELIEF,
    "trust": EmotionCategory.TRUST,
    "gratitude": EmotionCategory.GRATITUDE,
    "disgust": EmotionCategory.DISGUST,
    "anticipation": EmotionCategory.ANTICIPATION,
    "compassion": EmotionCategory.COMPASSION,
    "confusion": EmotionCategory.CONFUSION,
    "excitement": EmotionCategory.EXCITEMENT,
    "loneliness": EmotionCategory.LONELINESS,
    "pride": EmotionCategory.PRIDE,
    "shame": EmotionCategory.SHAME,
    "guilt": EmotionCategory.GUILT,
    "nostalgia": EmotionCategory.NOSTALGIA,
    "hope": EmotionCategory.HOPE,
    "admiration": EmotionCategory.ADMIRATION,
    "determination": EmotionCategory.DETERMINATION,
    "overwhelm": EmotionCategory.OVERWHELM,
    "affection": EmotionCategory.AFFECTION,
    "disappointment": EmotionCategory.DISAPPOINTMENT,
}


class EmotionCoreV13Provider:
    """Implement EmotionProvider for the existing standalone Emotion Core 1.3.

    Args:
        core: Optional instance exposing update(input) -> result.
        input_factory: Optional callable accepting keyword arguments text and source.
        model_version: Version string recorded in the normalized estimate.

    Only text requests are accepted. A transcript may be supplied as text, but this
    adapter does not claim to process raw audio, images, or fused multimodal signals.
    """

    def __init__(
        self,
        core: Any | None = None,
        input_factory: Callable[..., Any] | None = None,
        model_version: str = "1.3.0",
    ) -> None:
        if core is None or input_factory is None:
            try:
                from emotion_core import EmotionCore, EmotionInput
            except ImportError as exc:
                raise RuntimeError(
                    "Emotion Core 1.3 is not available. Put the extracted package root "
                    "on PYTHONPATH, or inject core and input_factory."
                ) from exc
            core = core if core is not None else EmotionCore()
            input_factory = input_factory if input_factory is not None else EmotionInput

        if not model_version.strip():
            raise ValueError("model_version must not be empty")
        self._core = core
        self._input_factory = input_factory
        self._model_version = model_version

    def analyze(self, request: EmotionRequest) -> EmotionEstimate:
        """Analyze a text signal and normalize the prototype's result."""
        if request.modality is not EmotionModality.TEXT:
            raise ValueError(
                "Emotion Core 1.3 adapter supports text modality only; "
                "audio/vision fusion is not implemented"
            )

        text = request.text or request.transcript
        if not text or not text.strip():
            raise ValueError("a non-empty text signal is required")

        incoming = self._input_factory(text=text, source=request.source_ref)
        result = self._core.update(incoming)
        state = getattr(result, "state", None)
        if state is None:
            raise ValueError("Emotion Core 1.3 returned a result without state")

        raw_label = str(getattr(state, "emotion", "unknown")).strip().casefold()
        confidence = float(getattr(state, "confidence", 0.0))
        ambiguities: list[str] = []

        if bool(getattr(result, "needs_clarification", False)):
            ambiguities.append("provider_requires_clarification")

        if confidence < 0.50:
            category = EmotionCategory.UNKNOWN
            ambiguities.append("low_confidence")
        else:
            category = _CATEGORY_MAP.get(raw_label, EmotionCategory.UNKNOWN)
            if category is EmotionCategory.UNKNOWN:
                ambiguities.append(f"unmapped_provider_category:{raw_label or 'empty'}")

        timestamp = _parse_timestamp(getattr(state, "timestamp", None))
        if timestamp is None:
            timestamp = datetime.now(timezone.utc)
            ambiguities.append("provider_timestamp_missing_or_invalid")

        # Evidence references contain identifiers only; keyword matches and raw text
        # are intentionally not copied into this cross-module estimate.
        return EmotionEstimate(
            request_id=request.request_id,
            category=category,
            valence=float(getattr(state, "valence", 0.0)),
            arousal=float(getattr(state, "arousal", 0.0)),
            intensity=float(getattr(state, "intensity", 0.0)),
            confidence=confidence,
            model_version=self._model_version,
            evidence_refs=(request.source_ref,),
            ambiguities=tuple(ambiguities),
            estimated_at=timestamp,
        )


def _parse_timestamp(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        return None
    return parsed
