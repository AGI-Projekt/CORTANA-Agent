from datetime import datetime, timezone

from fastapi.testclient import TestClient

from cortana.core import CortanaAgent, EchoModel
from cortana.emotion.contracts import EmotionCategory, EmotionEstimate
from cortana.web.app import create_app


class FakeEmotionProvider:
    def __init__(self, category: EmotionCategory, confidence: float):
        self.category = category
        self.confidence = confidence

    def analyze(self, request):
        return EmotionEstimate(
            request_id=request.request_id,
            category=self.category,
            valence=-0.6 if self.category in {EmotionCategory.ANGER, EmotionCategory.SADNESS} else 0.6,
            arousal=0.7,
            intensity=0.7,
            confidence=self.confidence,
            model_version="test-provider",
            evidence_refs=(request.source_ref,),
            estimated_at=datetime.now(timezone.utc),
        )


def _client(category: EmotionCategory, confidence: float) -> TestClient:
    return TestClient(
        create_app(
            agent=CortanaAgent(model=EchoModel()),
            emotion_provider=FakeEmotionProvider(category, confidence),
        )
    )


def test_realtime_emotion_response_includes_allowlisted_avatar_expression():
    response = _client(EmotionCategory.ANGER, 0.90).post(
        "/api/realtime/turn",
        json={"enabled": True, "transcript": "To mnie złości."},
    )
    assert response.status_code == 200
    assert response.json()["response_style"] == "supportive"
    assert response.json()["avatar_expression"] == "anger"


def test_realtime_emotion_below_confidence_gate_returns_calm_expression():
    response = _client(EmotionCategory.JOY, 0.60).post(
        "/api/realtime/turn",
        json={"enabled": True, "transcript": "To świetna wiadomość."},
    )
    assert response.status_code == 200
    assert response.json()["response_style"] == "neutral"
    assert response.json()["avatar_expression"] == "calm"


def test_realtime_emotion_disabled_returns_calm_expression():
    response = _client(EmotionCategory.JOY, 0.99).post(
        "/api/realtime/turn",
        json={"enabled": False},
    )
    assert response.status_code == 200
    assert response.json()["avatar_expression"] == "calm"
