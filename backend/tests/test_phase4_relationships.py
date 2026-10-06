"""NTAXCO Phase 4 relationship/integrity regression tests.

These tests are intentionally data-aware: they validate relationship endpoints
against records that already exist in the target environment and skip a graph
edge when the environment has no record of that type.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def admin_session():
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL is not configured")
    email = TEST_ADMIN_EMAIL
    password = TEST_ADMIN_PASSWORD
    s = requests.Session()
    r = s.post(f"{API}/auth/admin/login", json={"email": email, "password": password}, timeout=20)
    if r.status_code != 200:
        pytest.skip(f"Admin login unavailable in this environment: {r.status_code}")
    token = r.json().get("data", {}).get("access_token")
    if not token:
        pytest.skip("Admin login returned no access token")
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


def _first(s, name):
    r = s.get(f"{API}/{name}", timeout=20)
    assert r.status_code == 200, r.text
    rows = r.json().get("data", [])
    return rows[0] if rows else None


@pytest.mark.parametrize("name,required", [
    ("bookings", ("customer_id", "service_id")),
    ("invoices", ("customer_id", "service_id")),
])
def test_core_records_use_stable_relationship_ids(admin_session, name, required):
    row = _first(admin_session, name)
    if not row:
        pytest.skip(f"No {name} records exist")
    for key in required:
        assert row.get(key), f"{name} record {row.get('id')} is missing {key}"
        assert isinstance(row[key], str)
        assert row[key] != row.get("customer")
        assert row[key] != row.get("service")


def test_assigned_booking_uses_agent_id(admin_session):
    row = _first(admin_session, "bookings")
    if not row or not row.get("assigned_agent"):
        pytest.skip("No assigned booking exists")
    assert row.get("agent_id"), f"Assigned booking {row.get('id')} has no agent_id"


def test_payment_invoice_relationship_is_stable(admin_session):
    row = _first(admin_session, "payments")
    if not row:
        pytest.skip("No payment records exist")
    if row.get("invoice_no") or row.get("invoice_id"):
        assert row.get("invoice_id"), f"Payment {row.get('id')} is missing invoice_id"


@pytest.mark.parametrize("entity,name", [
    ("customer", "customers"),
    ("booking", "bookings"),
    ("service", "services"),
    ("agent", "agents"),
    ("invoice", "invoices"),
    ("payment", "payments"),
])
def test_relationship_endpoint(admin_session, entity, name):
    row = _first(admin_session, name)
    if not row:
        pytest.skip(f"No {name} records exist")
    r = admin_session.get(f"{API}/relationships/{entity}/{row['id']}", timeout=20)
    assert r.status_code == 200, r.text
    data = r.json().get("data")
    assert data and data.get("record", {}).get("id") == row["id"]


def test_invoice_financials_match_linked_payments(admin_session):
    invoice = _first(admin_session, "invoices")
    if not invoice:
        pytest.skip("No invoice records exist")
    r = admin_session.get(f"{API}/admin/invoices/{invoice['id']}/details", timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    financials = data["financials"]
    linked_total = round(sum(float(p.get("total") or p.get("amount") or 0)
                             for p in data.get("payments", [])
                             if p.get("status") in ("Completed", "Paid")), 2)
    assert round(float(financials["paid"]), 2) == linked_total
    assert round(float(financials["balance"]), 2) == round(
        max(float(financials["total"]) - linked_total, 0), 2
    )
