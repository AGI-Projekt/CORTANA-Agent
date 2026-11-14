# CORTANA Core — Identity & Memory Sync 0.7.1

## Scope

This milestone adds a device-key identity service and authenticated, device-scoped memory endpoints. It does **not** silently persist chat transcripts. Only records explicitly submitted by the Android memory UI are synchronized.

## Cryptographic flow

1. Android sends its DER SubjectPublicKeyInfo P-256 public key to `POST /api/identity/challenge` with purpose `register` or `login`.
2. Core returns a random one-time challenge and challenge ID. Challenges expire after five minutes and are consumed on the first completion attempt.
3. Android signs the challenge bytes with `SHA256withECDSA` using its non-exportable Android Keystore private key.
4. Android sends the challenge ID and Base64 signature to `POST /api/identity/complete`.
5. Core verifies the signature, stores the public key/fingerprint, and returns a random bearer token. Only its SHA-256 digest is stored server-side.
6. Android encrypts the bearer token with AES-256-GCM using a separate Android Keystore key.

Only P-256 EC keys are accepted. Device identity is identified by SHA-256 of the DER public key. Revoking a device invalidates its current token.

## API

| Method | Endpoint | Authentication | Purpose |
|---|---|---|---|
| POST | `/api/identity/challenge` | None | Start registration or login challenge |
| POST | `/api/identity/complete` | None | Verify signature and issue bearer token |
| GET | `/api/identity/me` | Bearer | Verify current device session |
| DELETE | `/api/identity/me` | Bearer | Revoke device token |
| GET | `/api/memory` | Bearer | List this device's memory |
| POST | `/api/memory` | Bearer | Add one explicitly supplied record |
| POST | `/api/memory/sync` | Bearer | Idempotently merge up to 200 records by record ID |
| DELETE | `/api/memory/{id}` | Bearer | Delete one owned record |
| DELETE | `/api/memory` | Bearer | Delete all records owned by this device |

The sync operation is additive/idempotent: it inserts missing IDs and updates records only when the ID already belongs to the same device. It does not currently propagate local deletions or provide conflict-resolution history.

## Storage and configuration

- SQLite database path: `CORTANA_IDENTITY_DB`; default `data/cortana_identity.sqlite3`.
- Install the web extra: `pip install -e '.[web]'`.
- The database contains public keys, token digests, and memory text. It never stores device private keys or bearer tokens in plaintext.
- Back up the SQLite database using an operationally controlled encrypted backup process. Do not expose the database file through static hosting.

## Security boundaries and deployment notes

- Serve the API only over HTTPS. The Android client rejects non-HTTPS base URLs.
- Use a private network or authenticated reverse proxy while rolling this out.
- This milestone authenticates identity and memory endpoints. The legacy `/api/chat` and `/api/session/clear` routes remain compatible with 0.6.0 and are not yet bound to device identity. Do not expose those routes publicly without an authenticated gateway.
- Add production rate limiting at the reverse proxy for challenge and completion endpoints.
- Challenge state is held in process memory. Use sticky routing or a shared challenge store before running multiple API workers.
- Tokens currently have no automatic expiry; revoke a device to invalidate its token. Short-lived access tokens and refresh rotation are a follow-up hardening task.
- A device identity is a cryptographic device credential, not proof of a human identity.
