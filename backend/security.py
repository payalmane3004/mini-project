import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from database import DATABASE_ENVIRONMENT, get_db
import models


TOKEN_ISSUER = "campussphere-api"
TOKEN_LIFETIME_SECONDS = 30 * 60
PASSWORD_HASH_ITERATIONS = 600_000
SUPPORTED_ROLES = {"admin", "student"}
bearer_scheme = HTTPBearer(auto_error=False)
_DEVELOPMENT_SECRET_KEY: bytes | None = None


class InvalidToken(ValueError):
    pass


def _secret_key() -> bytes:
    global _DEVELOPMENT_SECRET_KEY
    configured_key = os.getenv("JWT_SECRET_KEY", "")
    if len(configured_key) < 32:
        if DATABASE_ENVIRONMENT == "development":
            if _DEVELOPMENT_SECRET_KEY is None:
                _DEVELOPMENT_SECRET_KEY = secrets.token_bytes(48)
            return _DEVELOPMENT_SECRET_KEY
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not configured on the server",
        )
    return configured_key.encode("utf-8")


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _b64decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def hash_password(password: str) -> str:
    if len(password) < 12:
        raise ValueError("Passwords must contain at least 12 characters")
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PASSWORD_HASH_ITERATIONS
    )
    return f"pbkdf2_sha256${PASSWORD_HASH_ITERATIONS}${_b64encode(salt)}${_b64encode(digest)}"


def verify_password(password: str, encoded_hash: str | None) -> bool:
    try:
        algorithm, iterations_text, salt_text, digest_text = (encoded_hash or "").split("$")
        iterations = int(iterations_text)
        if algorithm != "pbkdf2_sha256" or not 100_000 <= iterations <= 1_000_000:
            raise ValueError("Unsupported password hash")
        salt = _b64decode(salt_text)
        expected = _b64decode(digest_text)
        if len(salt) < 16 or len(expected) != hashlib.sha256().digest_size:
            raise ValueError("Malformed password hash")
    except (ValueError, TypeError):
        # Use the normal work factor for unknown users and unsupported legacy
        # hashes so a login response does not reveal whether an email exists.
        hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), bytes(16), PASSWORD_HASH_ITERATIONS
        )
        return False

    actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(actual, expected)


def create_access_token(user_id: int, role: str, *, now: int | None = None) -> str:
    issued_at = int(time.time()) if now is None else now
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": str(user_id),
        "role": role,
        "iss": TOKEN_ISSUER,
        "iat": issued_at,
        "exp": issued_at + TOKEN_LIFETIME_SECONDS,
    }
    signing_input = f"{_b64encode(json.dumps(header, separators=(',', ':')).encode())}.{_b64encode(json.dumps(payload, separators=(',', ':')).encode())}"
    signature = hmac.new(_secret_key(), signing_input.encode("ascii"), hashlib.sha256).digest()
    return f"{signing_input}.{_b64encode(signature)}"


def decode_access_token(token: str, *, now: int | None = None) -> dict[str, Any]:
    try:
        encoded_header, encoded_payload, encoded_signature = token.split(".")
        signing_input = f"{encoded_header}.{encoded_payload}"
        header = json.loads(_b64decode(encoded_header))
        payload = json.loads(_b64decode(encoded_payload))
        signature = _b64decode(encoded_signature)
        expected = hmac.new(_secret_key(), signing_input.encode("ascii"), hashlib.sha256).digest()
        if header != {"alg": "HS256", "typ": "JWT"} or not hmac.compare_digest(signature, expected):
            raise InvalidToken("Invalid signature")

        current_time = int(time.time()) if now is None else now
        subject = int(payload["sub"])
        issued_at = int(payload["iat"])
        expires_at = int(payload["exp"])
        role = str(payload["role"]).lower()
        if (
            payload.get("iss") != TOKEN_ISSUER
            or subject < 1
            or role not in SUPPORTED_ROLES
            or issued_at > current_time + 30
            or expires_at <= current_time
            or expires_at <= issued_at
            or expires_at - issued_at > TOKEN_LIFETIME_SECONDS
        ):
            raise InvalidToken("Invalid or expired token")
        return {"user_id": subject, "role": role}
    except HTTPException:
        raise
    except Exception as error:
        if isinstance(error, InvalidToken):
            raise
        raise InvalidToken("Malformed or expired token") from error


def unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required or token invalid/expired",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise unauthorized()
    try:
        claims = decode_access_token(credentials.credentials)
    except InvalidToken:
        raise unauthorized()

    user = db.query(models.User).filter(models.User.id == claims["user_id"]).first()
    if user is None or (user.role or "").lower() != claims["role"]:
        raise unauthorized()
    return user


def require_roles(*allowed_roles: str):
    normalized_roles = {role.lower() for role in allowed_roles}

    def role_dependency(user: models.User = Depends(get_current_user)) -> models.User:
        if (user.role or "").lower() not in normalized_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user

    return role_dependency
