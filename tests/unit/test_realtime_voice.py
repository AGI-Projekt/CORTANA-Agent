from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from cortana.voice.realtime import ALLOWED_REALTIME_VOICES, RealtimeSessionProvider
from cortana.web.app import create_app


class FakeSecrets:
    def __init__(self):
        self.calls = []
    def create(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(value="ek_short_lived_test_token", expires_at=1_900_000_000)


class FakeClient:
    def __init__(self):
        self.realtime = SimpleNamespace(client_secrets=FakeSecrets())


def test_realtime_provider_mints_short_lived_secret_with_no_tools():
    client = FakeClient()
    provider = RealtimeSessionProvider(client=client, model="test-realtime", voice="cedar")
    result = provider.create_client_secret()
    assert result == {
        "value": "ek_short_lived_test_token",
        "expires_at": 1_900_000_000,
        "model": "test-realtime",
        "voice": "cedar",
    }
    call = client.realtime.client_secrets.calls[0]
    assert call["expires_after"] == {"anchor": "created_at", "seconds": 60}
    session = call["session"]
    assert session["type"] == "realtime"
    assert session["model"] == "test-realtime"
    assert session["tools"] == []
    assert session["audio"]["output"]["voice"] == "cedar"
    assert session["audio"]["input"]["turn_detection"]["type"] == "server_vad"
    assert session["audio"]["input"]["transcription"]["language"] == "pl"

@pytest.mark.parametrize("voice", ["", "unknown-voice", "../marin", "marin;echo"])
def test_realtime_provider_rejects_unrecognized_voices(voice):
    with pytest.raises(ValueError, match="Unsupported Realtime voice"):
        RealtimeSessionProvider(client=FakeClient()).create_client_secret(voice=voice)

def test_voice_allowlist_contains_documented_defaults():
    assert "marin" in ALLOWED_REALTIME_VOICES
    assert "cedar" in ALLOWED_REALTIME_VOICES

def test_realtime_provider_requires_server_side_api_key(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("CORTANA_LLM_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="requires OPENAI_API_KEY"):
        RealtimeSessionProvider()

class FakeRealtimeProvider:
    def __init__(self):
        self.requested_voices = []
    def create_client_secret(self, voice=None):
        self.requested_voices.append(voice)
        selected = voice or "marin"
        return {
            "value": "ek_browser_safe_token",
            "expires_at": 1_900_000_000,
            "model": "gpt-realtime-2.1",
            "voice": selected,
        }

def test_realtime_session_endpoint_returns_only_short_lived_secret_metadata():
    provider = FakeRealtimeProvider()
    client = TestClient(create_app(realtime_provider=provider))
    response = client.post("/api/realtime/session", json={"voice": "cedar"})
    assert response.status_code == 200
    assert response.json() == {
        "value": "ek_browser_safe_token",
        "expires_at": 1_900_000_000,
        "model": "gpt-realtime-2.1",
        "voice": "cedar",
    }
    assert provider.requested_voices == ["cedar"]
    assert response.headers["cache-control"] == "no-store"

def test_realtime_endpoint_returns_safe_error_when_provider_is_not_configured(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("CORTANA_LLM_API_KEY", raising=False)
    client = TestClient(create_app())
    response = client.post("/api/realtime/session", json={"voice": "marin"})
    assert response.status_code == 503
    assert "not configured" in response.json()["detail"].casefold()
