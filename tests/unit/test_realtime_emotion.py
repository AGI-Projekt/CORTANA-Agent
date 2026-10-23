from datetime import datetime, timezone
from fastapi.testclient import TestClient
from cortana.emotion.contracts import EmotionCategory, EmotionEstimate
from cortana.observability import PrivacyAuditLog
from cortana.web.app import create_app

TRANSCRIPT_SECRET = "private-spoken-sentence-do-not-log"

class FakeEmotionProvider:
    def __init__(self, category=EmotionCategory.ANXIETY, confidence=0.94, error=None, wrong_id=False):
        self.category = category
        self.confidence = confidence
        self.error = error
        self.wrong_id = wrong_id
        self.received = []
    def analyze(self, request):
        self.received.append(request)
        if self.error:
            raise self.error
        return EmotionEstimate(
            request_id="not-the-request" if self.wrong_id else request.request_id,
            category=self.category, valence=-0.2, arousal=0.7, intensity=0.6,
            confidence=self.confidence, model_version="test/1",
            estimated_at=datetime.now(timezone.utc),
        )

def test_realtime_turn_opt_in_maps_text_to_coarse_style_and_safe_instructions():
    audit = PrivacyAuditLog()
    provider = FakeEmotionProvider()
    client = TestClient(create_app(emotion_provider=provider, audit_log=audit))
    response = client.post("/api/realtime/turn", json={"enabled": True, "transcript": TRANSCRIPT_SECRET})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "adjusted"
    assert data["response_style"] == "supportive"
    assert "calmly and supportively" in data["instructions"]
    assert provider.received[0].text == TRANSCRIPT_SECRET
    assert provider.received[0].source_ref == "realtime-transcript"
    records = audit.snapshot()
    assert len(records) == 1
    assert records[0]["event"] == "realtime_emotion"
    assert records[0]["outcome"] == "adjusted"
    assert set(records[0]) == {"occurred_at", "event", "outcome", "duration_ms"}
    assert TRANSCRIPT_SECRET not in str(records)

def test_realtime_turn_defaults_to_neutral_when_emotion_confidence_is_low():
    audit = PrivacyAuditLog()
    client = TestClient(create_app(emotion_provider=FakeEmotionProvider(confidence=0.45), audit_log=audit))
    response = client.post("/api/realtime/turn", json={"enabled": True, "transcript": TRANSCRIPT_SECRET})
    assert response.status_code == 200
    assert response.json()["response_style"] == "neutral"
    assert response.json()["status"] == "neutral"
    assert "Optional presentation guidance" not in response.json()["instructions"]

def test_realtime_turn_provider_failure_falls_back_without_leaking_transcript():
    audit = PrivacyAuditLog()
    provider = FakeEmotionProvider(error=RuntimeError(TRANSCRIPT_SECRET))
    client = TestClient(create_app(emotion_provider=provider, audit_log=audit))
    response = client.post("/api/realtime/turn", json={"enabled": True, "transcript": TRANSCRIPT_SECRET})
    assert response.status_code == 200
    assert response.json()["status"] == "unavailable"
    assert response.json()["response_style"] == "neutral"
    assert TRANSCRIPT_SECRET not in str(audit.snapshot())

def test_realtime_turn_rejects_missing_transcript_when_opted_in():
    client = TestClient(create_app(emotion_provider=FakeEmotionProvider()))
    response = client.post("/api/realtime/turn", json={"enabled": True})
    assert response.status_code == 422

def test_realtime_turn_opt_out_resets_to_neutral_without_calling_provider():
    provider = FakeEmotionProvider()
    audit = PrivacyAuditLog()
    client = TestClient(create_app(emotion_provider=provider, audit_log=audit))
    response = client.post("/api/realtime/turn", json={"enabled": False})
    assert response.status_code == 200
    assert response.json()["status"] == "disabled"
    assert response.json()["response_style"] == "neutral"
    assert provider.received == []
    assert audit.snapshot()[0]["outcome"] == "disabled"

def test_invalid_emotion_request_correlation_is_ignored():
    provider = FakeEmotionProvider(wrong_id=True)
    client = TestClient(create_app(emotion_provider=provider))
    response = client.post("/api/realtime/turn", json={"enabled": True, "transcript": TRANSCRIPT_SECRET})
    assert response.status_code == 200
    assert response.json()["status"] == "invalid_response"
    assert response.json()["response_style"] == "neutral"
