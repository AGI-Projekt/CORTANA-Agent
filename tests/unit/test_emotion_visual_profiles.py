from datetime import datetime, timezone

import pytest

from cortana.emotion.contracts import EmotionCategory, EmotionEstimate
from cortana.emotion.visual_profiles import (
    SUPPORTED_VISUAL_EXPRESSIONS,
    resolve_visual_expression,
)


@pytest.mark.parametrize(
    ("category", "expected"),
    [
        (EmotionCategory.NEUTRAL, "calm"),
        (EmotionCategory.JOY, "joy"),
        (EmotionCategory.SADNESS, "sadness"),
        (EmotionCategory.ANGER, "anger"),
        (EmotionCategory.FEAR, "fear"),
        (EmotionCategory.SURPRISE, "surprise"),
        (EmotionCategory.DISGUST, "disgust"),
        (EmotionCategory.DETERMINATION, "determination"),
    ],
)
def test_basic_emotions_map_to_allowlisted_visual_expressions(category, expected):
    assert resolve_visual_expression(category, enabled=True) == expected
    assert expected in SUPPORTED_VISUAL_EXPRESSIONS


def test_disabled_unknown_and_unsupported_emotions_use_calm():
    assert resolve_visual_expression(EmotionCategory.JOY, enabled=False) == "calm"
    assert resolve_visual_expression("unknown", enabled=True) == "calm"
    assert resolve_visual_expression("not-a-real-emotion", enabled=True) == "calm"
    assert resolve_visual_expression(EmotionCategory.CURIOSITY, enabled=True) == "calm"


def test_low_confidence_estimate_cannot_enable_visual_expression():
    estimate = EmotionEstimate(
        request_id="test-request",
        category=EmotionCategory.ANGER,
        valence=-0.8,
        arousal=0.8,
        intensity=0.8,
        confidence=0.60,
        model_version="test",
        estimated_at=datetime.now(timezone.utc),
    )
    assert resolve_visual_expression(
        estimate.category,
        enabled=estimate.may_adjust_tone,
    ) == "calm"
