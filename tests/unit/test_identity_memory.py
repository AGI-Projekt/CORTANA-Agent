from __future__ import annotations

import base64

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

from cortana.web.app import create_app


def _register(client: TestClient):
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_der = private_key.public_key().public_bytes(
        serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo
    )
    public_b64 = base64.b64encode(public_der).decode()
    challenge = client.post("/api/identity/challenge", json={"public_key": public_b64, "purpose": "register"})
    assert challenge.status_code == 200
    signature = private_key.sign(challenge.json()["challenge"].encode(), ec.ECDSA(hashes.SHA256()))
    complete = client.post("/api/identity/complete", json={
        "challenge_id": challenge.json()["challenge_id"],
        "signature": base64.b64encode(signature).decode(),
    })
    assert complete.status_code == 200
    return complete.json()["access_token"]


def test_device_registration_and_authenticated_memory(tmp_path):
    client = TestClient(create_app(identity_db_path=tmp_path / "identity.sqlite3"))
    token = _register(client)
    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/memory").status_code == 401
    assert client.get("/api/memory", headers=headers).json() == {"records": []}
    created = client.post("/api/memory", json={"text": "Pamięć tylko za zgodą."}, headers=headers)
    assert created.status_code == 201
    memory_id = created.json()["record"]["id"]
    assert client.get("/api/memory", headers=headers).json()["records"][0]["text"] == "Pamięć tylko za zgodą."
    assert client.delete(f"/api/memory/{memory_id}", headers=headers).json()["status"] == "deleted"


def test_memory_isolation_between_registered_devices(tmp_path):
    client = TestClient(create_app(identity_db_path=tmp_path / "identity.sqlite3"))
    token_a, token_b = _register(client), _register(client)
    client.post("/api/memory", json={"text": "private"}, headers={"Authorization": f"Bearer {token_a}"})
    assert client.get("/api/memory", headers={"Authorization": f"Bearer {token_b}"}).json()["records"] == []


def test_challenge_is_single_use_and_bad_signature_is_rejected(tmp_path):
    client = TestClient(create_app(identity_db_path=tmp_path / "identity.sqlite3"))
    key = ec.generate_private_key(ec.SECP256R1())
    der = key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    challenge = client.post("/api/identity/challenge", json={
        "public_key": base64.b64encode(der).decode(), "purpose": "register",
    }).json()
    payload = {"challenge_id": challenge["challenge_id"], "signature": base64.b64encode(b"bad").decode()}
    assert client.post("/api/identity/complete", json=payload).status_code == 401
    assert client.post("/api/identity/complete", json=payload).status_code == 401


def test_revoked_device_token_is_rejected(tmp_path):
    client = TestClient(create_app(identity_db_path=tmp_path / "identity.sqlite3"))
    token = _register(client)
    headers = {"Authorization": f"Bearer {token}"}
    assert client.delete("/api/identity/me", headers=headers).status_code == 200
    assert client.get("/api/memory", headers=headers).status_code == 401
