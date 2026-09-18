"""
Tests for GET /api/calendar.
Uses the same in-memory SQLite + auth-override fixtures as other API tests.
"""
from datetime import date


# Far-future loan: first payment always in the future regardless of when tests run.
LOAN_FUTURE = {
    "name": "Майбутній кредит",
    "is_already_paying": False,
    "initial_amount": "100000.00",
    "total_planned_payments": 12,
    "input_mode": "rate",
    "annual_rate": "24",
    "first_payment_date": "2030-03-15",
}

# Far-past loan: first payment always overdue.
LOAN_PAST = {
    "name": "Старий кредит",
    "is_already_paying": False,
    "initial_amount": "50000.00",
    "total_planned_payments": 24,
    "input_mode": "rate",
    "annual_rate": "18",
    "first_payment_date": "2024-01-15",
}


def test_calendar_empty_no_loans(client):
    # Query a range far in the past before any test loan starts → no events.
    r = client.get("/api/calendar?from_date=2020-01-01&months=3")
    assert r.status_code == 200
    body = r.json()
    assert body["events"] == []
    assert "active_loans" in body


def test_calendar_active_loans_listed(client):
    cr = client.post("/api/loans", json=LOAN_FUTURE)
    loan_id = cr.json()["id"]
    r = client.get("/api/calendar?from_date=2030-03-01&months=3")
    body = r.json()
    # The newly created loan must appear in active_loans
    active = {l["loan_id"]: l for l in body["active_loans"]}
    assert loan_id in active
    assert active[loan_id]["loan_name"] == "Майбутній кредит"
    assert 1 <= active[loan_id]["color_index"] <= 10


def test_calendar_future_events_in_range(client):
    client.post("/api/loans", json=LOAN_FUTURE)
    r = client.get("/api/calendar?from_date=2030-03-01&months=3")
    assert r.status_code == 200
    events = r.json()["events"]
    assert len(events) > 0
    for ev in events:
        d = date.fromisoformat(ev["date"])
        assert date(2030, 3, 1) <= d < date(2030, 6, 1)


def test_calendar_future_event_fields(client):
    client.post("/api/loans", json=LOAN_FUTURE)
    r = client.get("/api/calendar?from_date=2030-03-01&months=1")
    events = r.json()["events"]
    assert len(events) >= 1
    ev = events[0]
    assert "date" in ev
    assert "loan_id" in ev
    assert "loan_name" in ev
    assert "color_index" in ev
    assert "planned_amount" in ev
    assert "is_paid" in ev
    assert "is_overdue" in ev
    assert ev["is_paid"] is False
    assert ev["loan_name"] == "Майбутній кредит"


def test_calendar_paid_event_appears(client):
    cr = client.post("/api/loans", json=LOAN_FUTURE)
    loan_id = cr.json()["id"]
    # Record the first scheduled payment
    client.post(f"/api/loans/{loan_id}/payments", json={
        "actual_date": "2030-03-15",
        "actual_amount": "9455.96",
        "planned_date": "2030-03-15",
        "planned_amount": "9455.96",
    })
    r = client.get("/api/calendar?from_date=2030-03-01&months=1")
    body = r.json()
    paid = [e for e in body["events"] if e["is_paid"]]
    assert len(paid) == 1
    assert paid[0]["date"] == "2030-03-15"
    assert paid[0]["is_overdue"] is False


def test_calendar_overdue_event(client):
    client.post("/api/loans", json=LOAN_PAST)
    r = client.get("/api/calendar?from_date=2024-01-01&months=2")
    body = r.json()
    overdue = [e for e in body["events"] if e["is_overdue"]]
    assert len(overdue) > 0
    for ev in overdue:
        assert ev["is_paid"] is False


def test_calendar_archived_loan_not_included(client):
    cr = client.post("/api/loans", json=LOAN_FUTURE)
    loan_id = cr.json()["id"]
    client.post(f"/api/loans/{loan_id}/archive")
    r = client.get("/api/calendar?from_date=2030-03-01&months=3")
    body = r.json()
    # The archived loan must not appear in events or active_loans
    assert all(e["loan_id"] != loan_id for e in body["events"])
    assert all(l["loan_id"] != loan_id for l in body["active_loans"])


def test_calendar_months_param_limits_range(client):
    client.post("/api/loans", json=LOAN_FUTURE)
    r1 = client.get("/api/calendar?from_date=2030-03-01&months=1")
    r3 = client.get("/api/calendar?from_date=2030-03-01&months=3")
    assert len(r3.json()["events"]) >= len(r1.json()["events"])


def test_calendar_extra_payment_excluded(client):
    cr = client.post("/api/loans", json=LOAN_FUTURE)
    loan_id = cr.json()["id"]
    # Extra payment — should NOT appear as a calendar event
    client.post(f"/api/loans/{loan_id}/payments", json={
        "actual_date": "2030-03-10",
        "actual_amount": "5000.00",
        "is_extra": True,
    })
    r = client.get("/api/calendar?from_date=2030-03-01&months=1")
    events = r.json()["events"]
    # Extra payments have no planned_date, so they shouldn't appear as paid events
    paid_on_10 = [e for e in events if e["date"] == "2030-03-10" and e["is_paid"]]
    assert paid_on_10 == []


def test_calendar_two_loans_each_have_events(client):
    cr1 = client.post("/api/loans", json=LOAN_FUTURE)
    cr2 = client.post("/api/loans", json={**LOAN_FUTURE, "name": "Другий кредит"})
    id1, id2 = cr1.json()["id"], cr2.json()["id"]
    r = client.get("/api/calendar?from_date=2030-03-01&months=1")
    body = r.json()
    # Both new loans must appear in active_loans and events
    active_ids = {l["loan_id"] for l in body["active_loans"]}
    assert id1 in active_ids and id2 in active_ids
    event_ids = {e["loan_id"] for e in body["events"]}
    assert id1 in event_ids and id2 in event_ids
