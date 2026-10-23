"""Local-only FastAPI wrapper for Cortana chat and audio transcription."""
from __future__ import annotations
import os
from pathlib import Path
from typing import Any, Protocol
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from cortana.audio import OpenAIAudioProvider
from cortana.audio.openai_audio import MAX_AUDIO_BYTES, SUPPORTED_AUDIO_SUFFIXES
from cortana.core import AgentRequest, CortanaAgent, EchoModel
from cortana.llm import OpenAIResponsesModel

STATIC_DIR = Path(__file__).resolve().parent / "static"

class ChatPayload(BaseModel):
    text: str = Field(min_length=1, max_length=10000)
    session_id: str = Field(min_length=1, max_length=128)

class ClearSessionPayload(BaseModel):
    session_id: str = Field(min_length=1, max_length=128)

class Transcriber(Protocol):
    def transcribe(self, filename: str, audio_bytes: bytes, content_type: str | None = None) -> str: ...

def _response_style(metadata: dict[str, object]) -> str:
    """Return a coarse presentation hint, never a claim about the user's inner state."""
    if not metadata.get("tone_adjusted"):
        return "neutral"
    category = metadata.get("emotion_category")
    if category in {"sadness", "anxiety", "fear", "overwhelm", "frustration", "anger"}:
        return "supportive"
    if category in {"confusion", "curiosity", "interest"}:
        return "exploratory"
    if category in {"joy", "excitement", "gratitude"}:
        return "upbeat"
    return "neutral"


def create_app(*, agent: Any | None = None, audio_provider: Transcriber | None = None) -> FastAPI:
    """Create an app with injectable dependencies for tests; never bind publicly by default."""
    app = FastAPI(title="Cortana Voice Prototype", version="0.3.0",
                  docs_url=None, redoc_url=None, openapi_url=None)
    runtime_agent = agent
    runtime_audio = audio_provider

    def get_agent() -> Any:
        nonlocal runtime_agent
        if runtime_agent is None:
            offline = os.getenv("CORTANA_OFFLINE", "").strip().casefold() in {"1", "true", "yes"}
            try:
                runtime_agent = CortanaAgent(model=EchoModel() if offline else OpenAIResponsesModel())
            except (ImportError, RuntimeError, ValueError) as exc:
                raise HTTPException(
                    status_code=503,
                    detail="Text model is not configured. Set OPENAI_API_KEY, or set CORTANA_OFFLINE=1 for the demo.",
                ) from exc
        return runtime_agent

    def get_audio_provider() -> Transcriber:
        nonlocal runtime_audio
        if runtime_audio is None:
            try:
                runtime_audio = OpenAIAudioProvider()
            except (ImportError, RuntimeError, ValueError) as exc:
                raise HTTPException(
                    status_code=503,
                    detail="Transcription is not configured. Install the llm extra and set OPENAI_API_KEY.",
                ) from exc
        return runtime_audio

    @app.middleware("http")
    async def security_headers(request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Frame-Options"] = "DENY"
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

    @app.get("/", include_in_schema=False)
    async def index():
        return FileResponse(STATIC_DIR / "index.html")

    @app.get("/api/health")
    async def health():
        return {"status": "ok", "service": "cortana-voice-prototype"}

    @app.post("/api/chat")
    async def chat(payload: ChatPayload):
        if not payload.text.strip() or not payload.session_id.strip():
            raise HTTPException(status_code=422, detail="Text and session ID must not be blank")
        try:
            answer = get_agent().respond(AgentRequest(text=payload.text, session_id=payload.session_id))
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=502, detail="Cortana could not complete this turn.") from exc
        return {
            "text": answer.text,
            "request_id": answer.request_id,
            "metadata": {
                "emotion_status": answer.metadata.get("emotion_status", "disabled"),
                "tone_adjusted": bool(answer.metadata.get("tone_adjusted", False)),
                "response_style": _response_style(answer.metadata),
            },
        }

    @app.post("/api/session/clear")
    async def clear_session(payload: ClearSessionPayload):
        if not payload.session_id.strip():
            raise HTTPException(status_code=422, detail="Session ID must not be blank")
        clear = getattr(get_agent(), "clear_session", None)
        if callable(clear):
            clear(payload.session_id)
        return {"status": "cleared"}

    @app.post("/api/transcribe")
    async def transcribe(file: UploadFile = File(...)):
        filename = Path(file.filename or "recording.webm").name
        try:
            audio_bytes = await file.read(MAX_AUDIO_BYTES + 1)
        finally:
            await file.close()
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Audio upload is empty")
        if len(audio_bytes) > MAX_AUDIO_BYTES:
            raise HTTPException(status_code=413, detail="Audio upload exceeds 25 MiB")
        if Path(filename).suffix.casefold() not in SUPPORTED_AUDIO_SUFFIXES:
            raise HTTPException(status_code=400, detail="Unsupported audio format")
        try:
            transcript = get_audio_provider().transcribe(filename, audio_bytes, file.content_type)
        except HTTPException:
            raise
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=502, detail="Audio transcription failed.") from exc
        if not transcript.strip():
            raise HTTPException(status_code=502, detail="Audio transcription returned no text")
        return {"text": transcript}
    return app
