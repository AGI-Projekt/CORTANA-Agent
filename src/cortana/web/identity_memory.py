"""Device-key identity, one-time challenges, bearer sessions and opt-in memory API."""
from __future__ import annotations

import base64
from contextlib import closing
import hashlib
import os
import secrets
import sqlite3
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field


class ChallengeRequest(BaseModel):
    public_key: str = Field(min_length=1, max_length=1024)
    purpose: str = Field(default="login", pattern="^(register|login)$")


class ChallengeCompletion(BaseModel):
    challenge_id: str = Field(min_length=36, max_length=36)
    signature: str = Field(min_length=1, max_length=256)


class MemoryCreate(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class MemorySync(BaseModel):
    records: list[dict[str, str]] = Field(default_factory=list, max_length=200)


class IdentityMemoryService:
    """SQLite-backed device identity and user-scoped memory store."""

    def __init__(self, database_path: str | Path | None = None) -> None:
        configured = database_path or os.getenv("CORTANA_IDENTITY_DB", "data/cortana_identity.sqlite3")
        self.database_path = str(configured)
        if self.database_path != ":memory:":
            Path(self.database_path).parent.mkdir(parents=True, exist_ok=True)
        self._pending: dict[str, dict[str, Any]] = {}
        self._lock = threading.Lock()
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        db = sqlite3.connect(self.database_path, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys = ON")
        return db

    def _initialize(self) -> None:
        with closing(self._connect()) as db:
            db.execute("PRAGMA journal_mode = WAL")
            db.executescript("""
                CREATE TABLE IF NOT EXISTS devices (
                    fingerprint TEXT PRIMARY KEY,
                    public_key BLOB NOT NULL,
                    token_hash TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    revoked_at TEXT
                );
                CREATE TABLE IF NOT EXISTS memories (
                    id TEXT PRIMARY KEY,
                    fingerprint TEXT NOT NULL REFERENCES devices(fingerprint) ON DELETE CASCADE,
                    text TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS memories_owner_created
                    ON memories(fingerprint, created_at);
            """)

    @staticmethod
    def _decode_public_key(encoded: str) -> tuple[bytes, ec.EllipticCurvePublicKey, str]:
        try:
            der = base64.b64decode(encoded, validate=True)
            key = serialization.load_der_public_key(der)
        except Exception as exc:
            raise HTTPException(status_code=422, detail="Invalid DER public key.") from exc
        if not isinstance(key, ec.EllipticCurvePublicKey) or not isinstance(key.curve, ec.SECP256R1):
            raise HTTPException(status_code=422, detail="Only EC P-256 public keys are accepted.")
        fingerprint = hashlib.sha256(der).hexdigest()
        return der, key, fingerprint

    def issue_challenge(self, public_key: str, purpose: str) -> dict[str, str]:
        der, _key, fingerprint = self._decode_public_key(public_key)
        with self._connect() as db:
            row = db.execute(
                "SELECT revoked_at FROM devices WHERE fingerprint=?", (fingerprint,)
            ).fetchone()
        if purpose == "register" and row is not None:
            raise HTTPException(status_code=409, detail="Device identity is already registered.")
        if purpose == "login" and (row is None or row["revoked_at"] is not None):
            raise HTTPException(status_code=404, detail="Active device identity was not found.")
        challenge_id = str(uuid4())
        challenge = secrets.token_urlsafe(32)
        with self._lock:
            now = time.monotonic()
            self._pending = {k: v for k, v in self._pending.items() if v["expires"] > now}
            self._pending[challenge_id] = {
                "challenge": challenge, "der": der, "fingerprint": fingerprint,
                "purpose": purpose, "expires": now + 300,
            }
        return {"challenge_id": challenge_id, "challenge": challenge, "expires_in": "300"}

    def complete_challenge(self, challenge_id: str, signature_b64: str) -> dict[str, str]:
        with self._lock:
            pending = self._pending.pop(challenge_id, None)
        if pending is None or pending["expires"] <= time.monotonic():
            raise HTTPException(status_code=401, detail="Challenge is missing, expired or already used.")
        try:
            public_key = serialization.load_der_public_key(pending["der"])
            signature = base64.b64decode(signature_b64, validate=True)
            public_key.verify(signature, pending["challenge"].encode("utf-8"), ec.ECDSA(hashes.SHA256()))
        except (InvalidSignature, ValueError, TypeError) as exc:
            raise HTTPException(status_code=401, detail="Challenge signature is invalid.") from exc

        fingerprint = pending["fingerprint"]
        with self._connect() as db:
            row = db.execute(
                "SELECT revoked_at FROM devices WHERE fingerprint=?", (fingerprint,)
            ).fetchone()
            if pending["purpose"] == "register":
                if row is not None:
                    raise HTTPException(status_code=409, detail="Device identity is already registered.")
                with db:
                    db.execute(
                        "INSERT INTO devices(fingerprint, public_key, token_hash, created_at) VALUES(?,?,?,?)",
                        (fingerprint, pending["der"], "pending", self._now()),
                    )
            elif row is None or row["revoked_at"] is not None:
                raise HTTPException(status_code=401, detail="Device identity is not active.")

            token = secrets.token_urlsafe(32)
            with db:
                db.execute(
                    "UPDATE devices SET token_hash=? WHERE fingerprint=?",
                    (hashlib.sha256(token.encode()).hexdigest(), fingerprint),
                )
        return {"access_token": token, "token_type": "Bearer", "device_id": fingerprint}

    def authenticate(self, authorization: str | None) -> str:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Bearer device token required.")
        token = authorization[7:].strip()
        if not token or len(token) > 256:
            raise HTTPException(status_code=401, detail="Invalid bearer token.")
        digest = hashlib.sha256(token.encode()).hexdigest()
        with self._connect() as db:
            row = db.execute(
                "SELECT fingerprint FROM devices WHERE token_hash=? AND revoked_at IS NULL",
                (digest,),
            ).fetchone()
        if row is None:
            raise HTTPException(status_code=401, detail="Device token is invalid or revoked.")
        return str(row["fingerprint"])

    def add_memory(self, owner: str, text: str) -> dict[str, str]:
        clean = text.strip()
        if not clean:
            raise HTTPException(status_code=422, detail="Memory text must not be blank.")
        record = {"id": str(uuid4()), "text": clean, "created_at": self._now()}
        with closing(self._connect()) as db, db:
            db.execute(
                "INSERT INTO memories(id, fingerprint, text, created_at) VALUES(?,?,?,?)",
                (record["id"], owner, record["text"], record["created_at"]),
            )
        return record

    def list_memories(self, owner: str) -> list[dict[str, str]]:
        with self._connect() as db:
            rows = db.execute(
                "SELECT id, text, created_at FROM memories WHERE fingerprint=? ORDER BY created_at, id",
                (owner,),
            ).fetchall()
        return [dict(row) for row in rows]

    def sync_memories(self, owner: str, records: list[dict[str, str]]) -> list[dict[str, str]]:
        if len(records) > 200:
            raise HTTPException(status_code=413, detail="At most 200 memory records may be synced at once.")
        normalized: list[dict[str, str]] = []
        for item in records:
            memory_id = item.get("id", "")
            text = item.get("text", "").strip()
            created_at = item.get("created_at", "")
            if not memory_id or len(memory_id) > 64 or not text or len(text) > 2000:
                raise HTTPException(status_code=422, detail="Invalid memory record in sync batch.")
            normalized.append({"id": memory_id, "text": text, "created_at": created_at or self._now()})
        with closing(self._connect()) as db, db:
            for item in normalized:
                db.execute(
                    """INSERT INTO memories(id, fingerprint, text, created_at) VALUES(?,?,?,?)
                       ON CONFLICT(id) DO UPDATE SET text=excluded.text, created_at=excluded.created_at
                       WHERE memories.fingerprint=excluded.fingerprint""",
                    (item["id"], owner, item["text"], item["created_at"]),
                )
        return self.list_memories(owner)

    def delete_memory(self, owner: str, memory_id: str) -> bool:
        with self._connect() as db, db:
            cursor = db.execute(
                "DELETE FROM memories WHERE id=? AND fingerprint=?", (memory_id, owner)
            )
        return cursor.rowcount > 0

    def clear_memories(self, owner: str) -> int:
        with self._connect() as db, db:
            cursor = db.execute("DELETE FROM memories WHERE fingerprint=?", (owner,))
        return cursor.rowcount

    def revoke(self, owner: str) -> None:
        with self._connect() as db, db:
            db.execute(
                "UPDATE devices SET revoked_at=?, token_hash=? WHERE fingerprint=?",
                (self._now(), secrets.token_hex(32), owner),
            )

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()


def create_identity_router(database_path: str | Path | None = None) -> APIRouter:
    service = IdentityMemoryService(database_path)
    router = APIRouter(prefix="/api")

    def current_device(authorization: str | None = Header(default=None)) -> str:
        return service.authenticate(authorization)

    @router.post("/identity/challenge")
    async def identity_challenge(payload: ChallengeRequest):
        return service.issue_challenge(payload.public_key, payload.purpose)

    @router.post("/identity/complete")
    async def identity_complete(payload: ChallengeCompletion):
        return service.complete_challenge(payload.challenge_id, payload.signature)

    @router.get("/identity/me")
    async def identity_me(device: str = Depends(current_device)):
        return {"device_id": device, "authenticated": True}

    @router.delete("/identity/me")
    async def identity_revoke(device: str = Depends(current_device)):
        service.revoke(device)
        return {"status": "revoked"}

    @router.get("/memory")
    async def memory_list(device: str = Depends(current_device)):
        return {"records": service.list_memories(device)}

    @router.post("/memory", status_code=201)
    async def memory_create(payload: MemoryCreate, device: str = Depends(current_device)):
        return {"record": service.add_memory(device, payload.text)}

    @router.post("/memory/sync")
    async def memory_sync(payload: MemorySync, device: str = Depends(current_device)):
        return {"records": service.sync_memories(device, payload.records)}

    @router.delete("/memory/{memory_id}")
    async def memory_delete(memory_id: str, device: str = Depends(current_device)):
        if not service.delete_memory(device, memory_id):
            raise HTTPException(status_code=404, detail="Memory record not found.")
        return {"status": "deleted"}

    @router.delete("/memory")
    async def memory_clear(device: str = Depends(current_device)):
        return {"status": "cleared", "deleted": service.clear_memories(device)}

    return router
