"""Map approved Emotion Core labels to safe, presentational avatar expressions.

The profiles drive Lilith/Cortana's visual presentation only. They are not diagnoses,
do not assert the user's inner state, and never grant or change agent permissions.
Unsupported or disabled estimates deliberately resolve to the calm expression.
"""
from __future__ import annotations

from cortana.emotion.contracts import EmotionCategory


_EXPRESSION_BY_CATEGORY: dict[EmotionCategory, str] = {
    EmotionCategory.NEUTRAL: "calm",
    EmotionCategory.JOY: "joy",
    EmotionCategory.SADNESS: "sadness",
    EmotionCategory.ANGER: "anger",
    EmotionCategory.FEAR: "fear",
    EmotionCategory.SURPRISE: "surprise",
    EmotionCategory.DISGUST: "disgust",
    EmotionCategory.DETERMINATION: "determination",
}

SUPPORTED_VISUAL_EXPRESSIONS: tuple[str, ...] = (
    "calm",
    "joy",
    "sadness",
    "anger",
    "fear",
    "surprise",
    "disgust",
    "determination",
)


def resolve_visual_expression(category: EmotionCategory | str, *, enabled: bool) -> str:
    """Return an allowlisted avatar expression, using calm unless explicitly enabled.

    Callers should pass enabled=True only after the existing confidence and opt-in
    policy checks succeed. Strings are accepted for provider/API boundaries; unknown
    labels, invalid values and unsupported categories safely return calm.
    """
    if not enabled:
        return "calm"

    try:
        normalized = category if isinstance(category, EmotionCategory) else EmotionCategory(category)
    except (TypeError, ValueError):
        return "calm"

    return _EXPRESSION_BY_CATEGORY.get(normalized, "calm")
