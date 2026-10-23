from types import SimpleNamespace
import pytest
from cortana.audio.openai_audio import OpenAIAudioProvider

class FakeTranscriptions:
    def __init__(self, text="To jest test."):
        self.text = text
        self.calls = []
    def create(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(text=self.text)

class FakeClient:
    def __init__(self, text="To jest test."):
        self.audio = SimpleNamespace(transcriptions=FakeTranscriptions(text))

def test_transcription_sends_buffer_to_provider_without_writing_file():
    client = FakeClient("Witaj, Cortano.")
    provider = OpenAIAudioProvider(client=client)
    assert provider.transcribe("voice.webm", b"fake-audio", "audio/webm") == "Witaj, Cortano."
    call = client.audio.transcriptions.calls[0]
    assert call["model"] == "gpt-transcribe"
    assert call["file"] == ("voice.webm", b"fake-audio", "audio/webm")

@pytest.mark.parametrize("filename", ["voice.exe", "../voice.exe", "voice.txt"])
def test_transcription_rejects_unsupported_formats(filename):
    provider = OpenAIAudioProvider(client=FakeClient())
    with pytest.raises(ValueError, match="Unsupported audio format"):
        provider.transcribe(filename, b"audio")

def test_transcription_rejects_empty_and_oversized_payload():
    provider = OpenAIAudioProvider(client=FakeClient(), max_audio_bytes=4)
    with pytest.raises(ValueError, match="empty"):
        provider.transcribe("voice.wav", b"")
    with pytest.raises(ValueError, match="size limit"):
        provider.transcribe("voice.wav", b"12345")

def test_transcription_rejects_empty_provider_output():
    provider = OpenAIAudioProvider(client=FakeClient(" "))
    with pytest.raises(RuntimeError, match="no text"):
        provider.transcribe("voice.wav", b"audio")

def test_provider_requires_api_key_without_injected_client(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("CORTANA_LLM_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="requires OPENAI_API_KEY"):
        OpenAIAudioProvider()
