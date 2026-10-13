"""Unit tests for the Emotion Core integration contract."""

from datetime import datetime, timezone

import pytest

from cortana.emotion.contracts import (
    EmotionCategory,
    EmotionEstimate,
    EmotionModality,
    EmotionRequest,
)


def make_request(**overrides):
    values = {
        "request_id": "req-001",
        "source_ref": "session:ephemeral-001",
        "modality": EmotionModality.TEXT,
        "observed_at": datetime.now(timezone.utc),
        "text": "This is a test sentence.",
    }
    values.update(overrides)
    return EmotionRequest(**values)


def make_estimate(**overrides):
    values = {
        "request_id": "req-001",
        "category": EmotionCategory.CURIOSITY,
        "valence": 0.4,
        "arousal": 0.5,
        "intensity": 0.3,
        "confidence": 0.8,
        "model_version": "test-provider/1",
    }
    values.update(overrides)
    return EmotionEstimate(**values)


def test_request_accepts_timezone_aware_timestamp_and_text():
    request = make_request()
    assert request.request_id == "req-001"


def test_request_rejects_empty_id():
    with pytest.raises(ValueError, match="request_id"):
        make_request(request_id=" ")


def test_request_rejects_naive_timestamp():
    with pytest.raises(ValueError, match="timezone"):
        make_request(observed_at=datetime(2026, 1, 1))


def test_request_requires_signal_not_context_alone():
    with pytest.raises(ValueError, match="signal field"):
        make_request(text=None, context_summary="A summary without any signal")


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("valence", -1.01),
        ("valence", 1.01),
        ("arousal", -0.01),
        ("arousal", 1.01),
        ("intensity", -0.01),
        ("intensity", 1.01),
        ("confidence", -0.01),
        ("confidence", 1.01),
    ],
)
def test_estimate_rejects_out_of_range_values(field, value):
    with pytest.raises(ValueError, match=field):
        make_estimate(**{field: value})


def test_estimate_rejects_boolean_as_numeric_value():
    with pytest.raises(TypeError, match="confidence"):
        make_estimate(confidence=True)


def test_unknown_or_low_confidence_never_enables_tone_adjustment():
    assert not make_estimate(category=EmotionCategory.UNKNOWN).may_adjust_tone
    assert not make_estimate(confidence=0.74).may_adjust_tone
    assert make_estimate(confidence=0.49).is_low_confidence


def test_estimate_requires_timezone_aware_timestamp():
    with pytest.raises(ValueError, match="timezone"):
        make_estimate(estimated_at=datetime(2026, 1, 1))


def test_estimate_rejects_empty_model_version():
    with pytest.raises(ValueError, match="model_version"):
        make_estimate(model_version=" ")
