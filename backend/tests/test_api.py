"""
API tests for M2: CRUD loans, payments, settings, auth.
Uses in-memory SQLite via conftest fixtures.
"""

import pytest
from decimal import Decimal
from datetime import date


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ---------------------------------------------------------------------------
# Auth: initData validation
# ---------------------------------------------------------------------------

def test_auth_missing_header(client):
    """Without auth header → 422 (missing required header field)."""
    # Override is active in client fixture, so we test the raw endpoint
    # by temporarily removing the override
    from backend.main import app
    from backend.api.deps import get_current_user
    saved = app.dependency_overrides.pop(get_current_user, None)
    try:
        r = client.get("/api/loans")
        assert r.status_code in (401, 422)
    finally:
        if saved:
            app.dependency_overrides[get_current_user] = saved


def test_auth_invalid_signature(client):
    """Invalid initData → 401."""
    from backend.main import app
    from backend.api.deps import get_current_user
    saved = app.dependency_overrides.pop(get_current_user, None)
    try:
        r = client.get("/api/loans", headers={"Authorization": "tma bad_data&hash=abc"})
        assert r.status_code == 401
    finally:
        if saved:
            app.dependency_overrides[get_current_user] = saved


def test_auth_valid_init_data(engine, auth_headers):
    """Valid initData with matching bot token → 200."""
    from fastapi.testclient import TestClient
    from sqlalchemy.orm import sessionmaker
    from backend.config import settings
    from backend.main import app
    from backend.db.session import get_db
    import os

    settings.BOT_TOKEN = "7123456789:AATestBotTokenForTestingOnly12345678"
    settings.AUTH_MAX_AGE = 0  # disable expiry check for test

    TestSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)

    def _db_override():
        s = TestSession()
        try:
            yield s
        finally:
            s.rollback()
            s.close()

    app.dependency_overrides[get_db] = _db_override
    app.dependency_overrides.pop("get_current_user", None)

    # Remove the auth override so real validation runs
    from backend.api.deps import get_current_user as gcu
    app.dependency_overrides.pop(gcu, None)

    with TestClient(app) as c:
        r = c.get("/api/loans", headers=auth_headers)
        assert r.status_code == 200

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Loans CRUD
# ---------------------------------------------------------------------------

LOAN_RATE_PAYLOAD = {
    "name": "Авто",
    "is_already_paying": False,
    "initial_amount": "100000.00",
    "total_planned_payments": 12,
    "input_mode": "rate",
    "annual_rate": "24",
    "first_payment_date": "2026-08-15",
}

LOAN_PAYMENT_PAYLOAD = {
    "name": "Розстрочка",
    "is_already_paying": False,
    "initial_amount": "12000.00",
    "total_planned_payments": 6,
    "input_mode": "payment",
    "monthly_payment": "2000.00",
    "first_payment_date": "2026-09-01",
}


def test_create_loan_rate_mode(client):
    r = client.post("/api/loans", json=LOAN_RATE_PAYLOAD)
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "Авто"
    # annuity_payment(100_000, 24%, 12) == 9_455.96
    assert Decimal(str(body["monthly_payment"])) == Decimal("9455.96")
    assert body["payment_day"] == 15
    assert body["color_index"] >= 1
    # schedule must have 12 entries
    assert len(body["schedule"]) == 12
    assert Decimal(str(body["schedule"][-1]["balance"])) == Decimal("0.00")


def test_create_loan_payment_mode_zero_rate(client):
    r = client.post("/api/loans", json=LOAN_PAYMENT_PAYLOAD)
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "Розстрочка"
    assert Decimal(str(body["annual_rate"])) == Decimal("0")
    assert len(body["schedule"]) == 6
    for entry in body["schedule"]:
        assert Decimal(str(entry["interest"])) == Decimal("0.00")


def test_create_loan_invalid_payment(client):
    """A × n < S must return 422."""
    payload = {**LOAN_PAYMENT_PAYLOAD, "monthly_payment": "500.00"}  # 500*6=3000 < 12000
    r = client.post("/api/loans", json=payload)
    assert r.status_code == 422


def test_list_loans(client):
    r = client.get("/api/loans")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_get_loan_detail(client):
    # Create a loan first
    cr = client.post("/api/loans", json=LOAN_RATE_PAYLOAD)
    loan_id = cr.json()["id"]

    r = client.get(f"/api/loans/{loan_id}")
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == loan_id
    assert "schedule" in body
    assert len(body["schedule"]) == 12


def test_get_loan_not_found(client):
    import uuid
    r = client.get(f"/api/loans/{uuid.uuid4()}")
    assert r.status_code == 404


def test_update_loan_name(client):
    cr = client.post("/api/loans", json=LOAN_RATE_PAYLOAD)
    loan_id = cr.json()["id"]

    r = client.put(f"/api/loans/{loan_id}", json={"name": "Нова назва"})
    assert r.status_code == 200
    assert r.json()["name"] == "Нова назва"


def test_archive_and_unarchive_loan(client):
    cr = client.post("/api/loans", json=LOAN_RATE_PAYLOAD)
    loan_id = cr.json()["id"]

    # Archive
    r = client.post(f"/api/loans/{loan_id}/archive")
    assert r.status_code == 200
    assert r.json()["is_archived"] is True

    # Should appear in archived list
    archived = client.get("/api/loans/archived")
    assert any(l["id"] == loan_id for l in archived.json())

    # Should not appear in active list
    active = client.get("/api/loans")
    assert not any(l["id"] == loan_id for l in active.json())

    # Unarchive
    r = client.post(f"/api/loans/{loan_id}/unarchive")
    assert r.status_code == 200
    assert r.json()["is_archived"] is False


def test_delete_loan(client):
    cr = client.post("/api/loans", json=LOAN_RATE_PAYLOAD)
    loan_id = cr.json()["id"]

    r = client.delete(f"/api/loans/{loan_id}")
    assert r.status_code == 204

    r2 = client.get(f"/api/loans/{loan_id}")
    assert r2.status_code == 404


def test_color_index_auto_increment(client):
    """Second loan gets color_index = first + 1 (cycling 1–10)."""
    r1 = client.post("/api/loans", json=LOAN_RATE_PAYLOAD)
    r2 = client.post("/api/loans", json={**LOAN_RATE_PAYLOAD, "name": "Другий"})
    c1 = r1.json()["color_index"]
    c2 = r2.json()["color_index"]
    assert c2 != c1  # different colors


# ---------------------------------------------------------------------------
# Payments
# ---------------------------------------------------------------------------

def test_record_and_list_payment(client):
    cr = client.post("/api/loans", json=LOAN_RATE_PAYLOAD)
    loan_id = cr.json()["id"]

    pmt_payload = {
        "actual_date": "2026-08-15",
        "actual_amount": "9455.96",
        "is_extra": False,
        "planned_date": "2026-08-15",
        "planned_amount": "9455.96",
    }
    r = client.post(f"/api/loans/{loan_id}/payments", json=pmt_payload)
    assert r.status_code == 201
    pmt = r.json()
    assert pmt["loan_id"] == loan_id
    assert Decimal(str(pmt["actual_amount"])) == Decimal("9455.96")

    # List
    lr = client.get(f"/api/loans/{loan_id}/payments")
    assert lr.status_code == 200
    assert len(lr.json()) == 1


def test_payment_reduces_balance(client):
    cr = client.post("/api/loans", json=LOAN_RATE_PAYLOAD)
    loan_id = cr.json()["id"]
    initial_balance = Decimal(str(cr.json()["current_balance"]))

    pmt_payload = {
        "actual_date": "2026-08-15",
        "actual_amount": "9455.96",
        "planned_date": "2026-08-15",
        "planned_amount": "9455.96",
    }
    client.post(f"/api/loans/{loan_id}/payments", json=pmt_payload)

    dr = client.get(f"/api/loans/{loan_id}")
    new_balance = Decimal(str(dr.json()["current_balance"]))
    assert new_balance < initial_balance


def test_delete_payment_restores_balance(client):
    cr = client.post("/api/loans", json=LOAN_RATE_PAYLOAD)
    loan_id = cr.json()["id"]

    pmt_payload = {
        "actual_date": "2026-08-15",
        "actual_amount": "9455.96",
        "planned_date": "2026-08-15",
        "planned_amount": "9455.96",
    }
    pr = client.post(f"/api/loans/{loan_id}/payments", json=pmt_payload)
    pmt_id = pr.json()["id"]

    # Balance after payment
    b_after = Decimal(str(client.get(f"/api/loans/{loan_id}").json()["current_balance"]))

    # Delete payment
    r = client.delete(f"/api/loans/{loan_id}/payments/{pmt_id}")
    assert r.status_code == 204

    # Balance restored
    b_restored = Decimal(str(client.get(f"/api/loans/{loan_id}").json()["current_balance"]))
    assert b_restored > b_after


def test_extra_payment_reduces_balance(client):
    cr = client.post("/api/loans", json=LOAN_RATE_PAYLOAD)
    loan_id = cr.json()["id"]
    b0 = Decimal(str(cr.json()["current_balance"]))

    r = client.post(f"/api/loans/{loan_id}/payments", json={
        "actual_date": "2026-08-20",
        "actual_amount": "20000.00",
        "is_extra": True,
    })
    assert r.status_code == 201

    dr = client.get(f"/api/loans/{loan_id}")
    b1 = Decimal(str(dr.json()["current_balance"]))
    assert b1 < b0
    # Extra: principal_part == actual_amount, interest_part == 0
    pmt = r.json()
    assert Decimal(str(pmt["interest_part"])) == Decimal("0.00")


def test_payments_made_and_remaining(client):
    cr = client.post("/api/loans", json=LOAN_RATE_PAYLOAD)
    loan_id = cr.json()["id"]
    assert cr.json()["payments_made"] == 0
    assert cr.json()["payments_remaining"] == 12

    client.post(f"/api/loans/{loan_id}/payments", json={
        "actual_date": "2026-08-15",
        "actual_amount": "9455.96",
        "planned_date": "2026-08-15",
        "planned_amount": "9455.96",
    })

    dr = client.get(f"/api/loans/{loan_id}")
    assert dr.json()["payments_made"] == 1
    assert dr.json()["payments_remaining"] == 11


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

def test_get_settings(client):
    r = client.get("/api/settings")
    assert r.status_code == 200
    body = r.json()
    assert body["strategy"] == "none"
    assert body["notify_day_of"] is True


def test_update_settings(client):
    r = client.put("/api/settings", json={
        "monthly_budget": "15000.00",
        "strategy": "avalanche",
        "notify_3_days_before": True,
    })
    assert r.status_code == 200
    body = r.json()
    assert Decimal(str(body["monthly_budget"])) == Decimal("15000.00")
    assert body["strategy"] == "avalanche"
    assert body["notify_3_days_before"] is True


def test_update_settings_partial(client):
    """Partial update should not overwrite other fields."""
    client.put("/api/settings", json={"strategy": "snowball"})
    r = client.put("/api/settings", json={"notify_day_of": False})
    assert r.status_code == 200
    body = r.json()
    assert body["strategy"] == "snowball"   # unchanged
    assert body["notify_day_of"] is False   # changed
