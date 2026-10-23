from fastapi.testclient import TestClient
from cortana.core import CortanaAgent, EchoModel
from cortana.web.app import create_app

class FakeAudio:
    def __init__(self):
        self.calls = []
    def transcribe(self, filename, audio_bytes, content_type=None):
        self.calls.append((filename, audio_bytes, content_type))
        return "Cześć, Cortano."

def test_web_health_chat_and_ui_assets():
    client = TestClient(create_app(agent=CortanaAgent(model=EchoModel()), audio_provider=FakeAudio()))
    assert client.get("/api/health").json()["status"] == "ok"
    page = client.get("/")
    assert page.status_code == 200
    assert "CORTANA" in page.text
    assert client.get("/static/app.js").status_code == 200
    assert client.get("/static/avatar3d.js").status_code == 200
    assert "realtime-button" in page.text
    assert "realtime-voice-select" in page.text
    answer = client.post("/api/chat", json={"text":"Cześć","session_id":"test-session"})
    assert answer.status_code == 200
    assert answer.json()["text"] == "Rozumiem: Cześć"
    assert answer.headers["cache-control"] == "no-store"

def test_web_transcription_receives_upload_in_memory():
    audio = FakeAudio()
    client = TestClient(create_app(agent=CortanaAgent(model=EchoModel()), audio_provider=audio))
    response = client.post("/api/transcribe", files={"file":("test.webm",b"audio-bytes","audio/webm")})
    assert response.status_code == 200
    assert response.json()["text"] == "Cześć, Cortano."
    assert audio.calls == [("test.webm",b"audio-bytes","audio/webm")]

def test_web_transcription_rejects_unsupported_format():
    client = TestClient(create_app(agent=CortanaAgent(model=EchoModel()), audio_provider=FakeAudio()))
    response = client.post("/api/transcribe", files={"file":("payload.txt",b"hello","text/plain")})
    assert response.status_code == 400

def test_clear_session_endpoint():
    agent = CortanaAgent(model=EchoModel())
    client = TestClient(create_app(agent=agent, audio_provider=FakeAudio()))
    client.post("/api/chat", json={"text":"secret","session_id":"session-a"})
    response = client.post("/api/session/clear", json={"session_id":"session-a"})
    assert response.status_code == 200
    assert response.json()["status"] == "cleared"


def test_response_style_is_coarse_and_defaults_to_neutral():
    from cortana.web.app import _response_style

    assert _response_style({"emotion_status": "disabled"}) == "neutral"
    assert _response_style({"tone_adjusted": False, "emotion_category": "sadness"}) == "neutral"
    assert _response_style({"tone_adjusted": True, "emotion_category": "anxiety"}) == "supportive"
    assert _response_style({"tone_adjusted": True, "emotion_category": "curiosity"}) == "exploratory"
    assert _response_style({"tone_adjusted": True, "emotion_category": "joy"}) == "upbeat"
    assert _response_style({"tone_adjusted": True, "emotion_category": "unknown"}) == "neutral"


def test_avatar_assets_include_live_audio_lipsync_and_blink_hooks():
    from pathlib import Path
    import cortana.web.app as app_module

    static_dir = Path(app_module.__file__).resolve().parent / "static"
    app_script = (static_dir / "app.js").read_text(encoding="utf-8")
    avatar_script = (static_dir / "avatar3d.js").read_text(encoding="utf-8")

    assert "startRemoteAudioAnalysis" in app_script
    assert "getByteTimeDomainData" in app_script
    assert "dataset.liveAudio" in app_script
    assert "nextBlinkAt" in avatar_script
    assert "eyeLeft.scale.y" in avatar_script
    assert "dataset.mouthOpen" in avatar_script
