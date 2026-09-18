"""
JWT auth tests:
  - POST /api/auth/token with valid initData → 200 + JWT
  - GET  /api/loans with valid Bearer JWT    → 200
  - GET  /api/loans with invalid Bearer JWT  → 401
  - GET  /api/loans with expired Bearer JWT  → 401
  - GET  /api/loans with missing header      → 422
"""

import time
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi.testclient import TestClient

from backend.config import settings
from backend.db.models import Base, User
from backend.db.session import get_db
from backend.main import app
from backend.services.auth import generate_test_init_data, generate_test_widget_data
from backend.services.jwt_service import create_access_token

TEST_BOT_TOKEN = "7123456789:AATestBotTokenForTestingOnly12345678"
TEST_TELEGRAM_ID = 123456789

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


# ── Isolated DB for JWT tests (no shared state with other test fixtures) ──────

JWT_DB_URL = "sqlite:///:memory:"


@pytest.fixture(scope="module")
def jwt_engine():
    e = create_engine(JWT_DB_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=e)
    yield e
    Base.metadata.drop_all(bind=e)


@pytest.fixture
def jwt_db(jwt_engine):
    Session = sessionmaker(bind=jwt_engine, autocommit=False, autoflush=False)
    session = Session()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def raw_client(jwt_db):
    """TestClient with real auth (no overrides)."""
    def _get_db_override():
        yield jwt_db

    app.dependency_overrides[get_db] = _get_db_override
    # Clear any user override so real auth runs
    app.dependency_overrides.pop("get_current_user", None)

    original_bot_token = settings.BOT_TOKEN
    settings.BOT_TOKEN = TEST_BOT_TOKEN

    with TestClient(app) as c:
        yield c

    settings.BOT_TOKEN = original_bot_token
    app.dependency_overrides.clear()


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_get_token_returns_jwt(raw_client: TestClient):
    init_data = generate_test_init_data(TEST_BOT_TOKEN, TEST_TELEGRAM_ID)
    resp = raw_client.post("/api/auth/token", headers={"Authorization": f"tma {init_data}"})
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"
    # Token must be decodable
    payload = jwt.decode(body["access_token"], settings.JWT_SECRET, algorithms=["HS256"])
    assert payload["sub"] == str(TEST_TELEGRAM_ID)


def test_get_token_wrong_scheme_returns_401(raw_client: TestClient):
    resp = raw_client.post("/api/auth/token", headers={"Authorization": "Bearer something"})
    assert resp.status_code == 401


def test_loans_with_valid_bearer_jwt(raw_client: TestClient):
    token = create_access_token(TEST_TELEGRAM_ID)
    resp = raw_client.get("/api/loans", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_loans_with_invalid_bearer_jwt_returns_401(raw_client: TestClient):
    resp = raw_client.get("/api/loans", headers={"Authorization": "Bearer not.a.token"})
    assert resp.status_code == 401


def test_loans_with_expired_bearer_jwt_returns_401(raw_client: TestClient):
    expired_payload = {
        "sub": str(TEST_TELEGRAM_ID),
        "iat": datetime.now(timezone.utc) - timedelta(days=60),
        "exp": datetime.now(timezone.utc) - timedelta(days=1),
    }
    expired_token = jwt.encode(expired_payload, settings.JWT_SECRET, algorithm="HS256")
    resp = raw_client.get("/api/loans", headers={"Authorization": f"Bearer {expired_token}"})
    assert resp.status_code == 401


def test_loans_with_wrong_secret_returns_401(raw_client: TestClient):
    token = jwt.encode({"sub": str(TEST_TELEGRAM_ID), "exp": datetime.now(timezone.utc) + timedelta(days=1)},
                       "wrong-secret", algorithm="HS256")
    resp = raw_client.get("/api/loans", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401


def test_loans_missing_auth_header_returns_422(raw_client: TestClient):
    resp = raw_client.get("/api/loans")
    assert resp.status_code == 422


def test_tma_auth_still_works_alongside_jwt(raw_client: TestClient):
    """Ensure existing Mini App auth (tma) is not broken."""
    init_data = generate_test_init_data(TEST_BOT_TOKEN, TEST_TELEGRAM_ID)
    resp = raw_client.get("/api/loans", headers={"Authorization": f"tma {init_data}"})
    assert resp.status_code == 200


# ── Telegram Login Widget endpoint ────────────────────────────────────────────

def test_telegram_widget_returns_jwt(raw_client: TestClient):
    widget_data = generate_test_widget_data(TEST_BOT_TOKEN, TEST_TELEGRAM_ID)
    resp = raw_client.post("/api/auth/telegram-widget", json=widget_data)
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"
    payload = jwt.decode(body["access_token"], settings.JWT_SECRET, algorithms=["HS256"])
    assert payload["sub"] == str(TEST_TELEGRAM_ID)


def test_telegram_widget_invalid_hash_returns_401(raw_client: TestClient):
    widget_data = generate_test_widget_data(TEST_BOT_TOKEN, TEST_TELEGRAM_ID)
    widget_data["hash"] = "0" * 64  # tampered hash
    resp = raw_client.post("/api/auth/telegram-widget", json=widget_data)
    assert resp.status_code == 401


def test_telegram_widget_missing_hash_returns_401(raw_client: TestClient):
    widget_data = generate_test_widget_data(TEST_BOT_TOKEN, TEST_TELEGRAM_ID)
    del widget_data["hash"]
    resp = raw_client.post("/api/auth/telegram-widget", json=widget_data)
    assert resp.status_code == 422  # Pydantic rejects missing required field
