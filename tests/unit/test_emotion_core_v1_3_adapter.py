from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from cortana.emotion.contracts import EmotionCategory, EmotionModality, EmotionRequest
from cortana.emotion.emotion_core_v1_3 import EmotionCoreV13Provider


@dataclass
class FakeInput:
    text: str
    source: str


class FakeCore:
    def __init__(self, state, needs_clarification=False):
        self.state = state
        self.needs_clarification = needs_clarification
        self.received = None

    def update(self, incoming):
        self.received = incoming
        return SimpleNamespace(
            state=self.state,
            needs_clarification=self.needs_clarification,
        )


def make_request(**overrides):
    values = {
        "request_id": "req-123",
        "source_ref": "conversation:turn-7",
        "modality": EmotionModality.TEXT,
        "observed_at": datetime(2026, 10, 13, 10, 0, tzinfo=timezone.utc),
        "text": "Jestem ciekaw, jak działa ten moduł",
    }
    values.update(overrides)
    return EmotionRequest(**values)


def make_state(**overrides):
    values = {
        "emotion": "curiosity",
        "valence": 0.45,
        "arousal": 0.55,
        "intensity": 0.7,
        "confidence": 0.8,
        "timestamp": "2026-10-13T10:00:01+00:00",
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def provider_for(state, needs_clarification=False):
    core = FakeCore(state, needs_clarification=needs_clarification)
    return EmotionCoreV13Provider(core=core, input_factory=FakeInput), core


def test_maps_supported_label_and_preserves_request_correlation():
    provider, core = provider_for(make_state())
    estimate = provider.analyze(make_request())

    assert estimate.request_id == "req-123"
    assert estimate.category is EmotionCategory.CURIOSITY
    assert estimate.model_version == "1.3.0"
    assert estimate.confidence == 0.8
    assert estimate.estimated_at.tzinfo is not None
    assert core.received.text == "Jestem ciekaw, jak działa ten moduł"
    assert core.received.source == "conversation:turn-7"


def test_low_confidence_becomes_unknown():
    provider, _ = provider_for(make_state(confidence=0.42))
    estimate = provider.analyze(make_request())

    assert estimate.category is EmotionCategory.UNKNOWN
    assert "low_confidence" in estimate.ambiguities
    assert estimate.may_adjust_tone is False


def test_mixed_or_unmapped_label_is_not_forced_into_known_category():
    provider, _ = provider_for(
        make_state(emotion="mixed"),
        needs_clarification=True,
    )
    estimate = provider.analyze(make_request())

    assert estimate.category is EmotionCategory.UNKNOWN
    assert "provider_requires_clarification" in estimate.ambiguities
    assert "unmapped_provider_category:mixed" in estimate.ambiguities


def test_transcript_can_be_used_as_text_signal():
    provider, core = provider_for(make_state(emotion="gratitude"))
    request = make_request(text=None, transcript="Dziękuję za pomoc")
    estimate = provider.analyze(request)

    assert core.received.text == "Dziękuję za pomoc"
    assert estimate.category is EmotionCategory.GRATITUDE


@pytest.mark.parametrize(
    "modality",
    [EmotionModality.AUDIO, EmotionModality.VISION, EmotionModality.MULTIMODAL],
)
def test_rejects_modalities_not_supported_by_v13(modality):
    provider, _ = provider_for(make_state())
    request = make_request(
        modality=modality,
        text="A text signal is present, but the modality is not supported.",
    )

    with pytest.raises(ValueError, match="text modality only"):
        provider.analyze(request)


def test_rejects_malformed_provider_result():
    class BrokenCore:
        def update(self, incoming):
            return SimpleNamespace()

    provider = EmotionCoreV13Provider(core=BrokenCore(), input_factory=FakeInput)
    with pytest.raises(ValueError, match="without state"):
        provider.analyze(make_request())


def test_does_not_copy_raw_text_into_estimate():
    provider, _ = provider_for(make_state())
    request = make_request(text="PRIVATE TEXT THAT MUST NOT BE COPIED")
    estimate = provider.analyze(request)

    assert not hasattr(estimate, "text")
    assert all("PRIVATE TEXT" not in ref for ref in estimate.evidence_refs)
