"""In-memory speech-to-text adapter. Audio is not written to local disk."""
from __future__ import annotations
import os
from pathlib import Path
from typing import Any

MAX_AUDIO_BYTES = 25 * 1024 * 1024
SUPPORTED_AUDIO_SUFFIXES = frozenset({
    ".flac", ".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".ogg", ".wav", ".webm",
})

class OpenAIAudioProvider:
    """Transcribe completed audio uploads using the current transcription API."""
    def __init__(
        self, *, client: Any | None = None, api_key: str | None = None,
        transcription_model: str = "gpt-transcribe", max_audio_bytes: int = MAX_AUDIO_BYTES,
    ) -> None:
        if not transcription_model.strip():
            raise ValueError("transcription_model must not be empty")
        if max_audio_bytes < 1:
            raise ValueError("max_audio_bytes must be positive")
        self.transcription_model = transcription_model
        self.max_audio_bytes = max_audio_bytes
        self._client = client
        if self._client is not None:
            return
        resolved_key = api_key or os.getenv("CORTANA_LLM_API_KEY") or os.getenv("OPENAI_API_KEY")
        if not resolved_key:
            raise RuntimeError("Speech transcription requires OPENAI_API_KEY or CORTANA_LLM_API_KEY")
        try:
            from openai import OpenAI
        except ImportError as exc:
            raise RuntimeError(
                'Install the optional OpenAI SDK with python -m pip install -e ".[llm]".'
            ) from exc
        self._client = OpenAI(api_key=resolved_key, timeout=60.0, max_retries=1)

    def transcribe(self, filename: str, audio_bytes: bytes, content_type: str | None = None) -> str:
        """Transcribe validated audio bytes using memory-only buffering."""
        safe_name = Path(filename or "recording.webm").name
        suffix = Path(safe_name).suffix.casefold()
        if suffix not in SUPPORTED_AUDIO_SUFFIXES:
            raise ValueError("Unsupported audio format")
        if not audio_bytes:
            raise ValueError("Audio payload is empty")
        if len(audio_bytes) > self.max_audio_bytes:
            raise ValueError("Audio payload exceeds the configured size limit")
        upload = (safe_name, audio_bytes, content_type or "application/octet-stream")
        result = self._client.audio.transcriptions.create(
            model=self.transcription_model, file=upload,
        )
        transcript = getattr(result, "text", None)
        if not isinstance(transcript, str) or not transcript.strip():
            raise RuntimeError("Transcription provider returned no text")
        return transcript.strip()
