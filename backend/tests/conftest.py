"""
Test fixtures: in-memory SQLite DB + FastAPI dependency overrides.
Tests never touch a real PostgreSQL instance.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from backend.db.models import Base, User
from backend.db.session import get_db
from backend.api.deps import get_current_user
from backend.main import app

TEST_DB_URL = "sqlite:///:memory:"
TEST_BOT_TOKEN = "7123456789:AATestBotTokenForTestingOnly12345678"
TEST_TELEGRAM_ID = 123456789


@pytest.fixture(scope="session")
def engine():
    # StaticPool ensures all sessions share the same in-memory SQLite connection.
    e = create_engine(
        TEST_DB_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=e)
    yield e
    Base.metadata.drop_all(bind=e)


@pytest.fixture
def db(engine) -> Session:
    TestSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = TestSession()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def client(db: Session) -> TestClient:
    """TestClient with DB and auth overridden."""

    def _get_db_override():
        yield db

    def _get_user_override():
        user = db.query(User).filter(User.telegram_id == TEST_TELEGRAM_ID).first()
        if not user:
            user = User(telegram_id=TEST_TELEGRAM_ID)
            db.add(user)
            db.commit()
            db.refresh(user)
        return user

    app.dependency_overrides[get_db] = _get_db_override
    app.dependency_overrides[get_current_user] = _get_user_override

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers() -> dict:
    """Headers for tests that go through real auth (e.g. auth validation test)."""
    from backend.services.auth import generate_test_init_data
    init_data = generate_test_init_data(TEST_BOT_TOKEN, TEST_TELEGRAM_ID)
    return {"Authorization": f"tma {init_data}"}
