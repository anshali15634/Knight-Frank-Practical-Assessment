from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

TOKEN_LIFETIME_SECONDS = 12 * 60 * 60
bearer_scheme = HTTPBearer(auto_error=False)


def _signing_key() -> bytes:
    secret = os.getenv("SUPABASE_SECRET_KEY")
    if not secret:
        raise RuntimeError("Missing SUPABASE_SECRET_KEY")
    return hmac.new(
        secret.encode("utf-8"),
        b"knight-frank-favourites-session-v1",
        hashlib.sha256,
    ).digest()


def _encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def create_access_token(user_id: str | UUID) -> str:
    payload = _encode(
        json.dumps(
            {
                "sub": str(UUID(str(user_id))),
                "exp": int(time.time()) + TOKEN_LIFETIME_SECONDS,
            },
            separators=(",", ":"),
        ).encode("utf-8")
    )
    signature = _encode(
        hmac.new(_signing_key(), payload.encode("ascii"), hashlib.sha256).digest()
    )
    return f"{payload}.{signature}"


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="A valid login is required.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def authenticated_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> UUID:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _unauthorized()

    try:
        payload_part, signature_part = credentials.credentials.split(".", maxsplit=1)
        expected_signature = _encode(
            hmac.new(
                _signing_key(),
                payload_part.encode("ascii"),
                hashlib.sha256,
            ).digest()
        )
        if not hmac.compare_digest(signature_part, expected_signature):
            raise _unauthorized()

        padding = "=" * (-len(payload_part) % 4)
        payload = json.loads(
            base64.urlsafe_b64decode(payload_part + padding)
        )
        if not isinstance(payload, dict):
            raise _unauthorized()
        if type(payload.get("exp")) is not int or payload["exp"] <= int(time.time()):
            raise _unauthorized()
        return UUID(payload["sub"])
    except HTTPException:
        raise
    except (ValueError, TypeError, KeyError, UnicodeDecodeError, json.JSONDecodeError):
        raise _unauthorized() from None
