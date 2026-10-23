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
