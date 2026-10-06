"""NTAXCO ERP Phase-6 tests: verify seed counts for payments/agents/documents/bookings and customer booking create."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"
TEST_ADMIN_EMAIL = os.environ.get("NTAXCO_TEST_ADMIN_EMAIL") or os.environ.get("ADMIN_EMAIL") or "chinmayiracharla58@gmail.com"
TEST_ADMIN_PASSWORD = os.environ.get("NTAXCO_TEST_ADMIN_PASSWORD") or os.environ.get("ADMIN_PASSWORD") or "Admin@12"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/admin/login", json={"email": TEST_ADMIN_EMAIL, "password": TEST_ADMIN_PASSWORD})
    return r.json()["data"]["access_token"]


@pytest.fixture(scope="module")
def customer_token():
    # Mobile OTP now goes through real Twilio Verify (see backend_test.py for
    # dedicated, mocked OTP-flow tests) — a fixed "123456" code no longer
    # validates. This fixture only needs *an* authenticated customer to
    # exercise booking endpoints, so use the email/password path instead.
    r = requests.post(f"{API}/auth/portal/login", json={"email": "phase6-customer@ntaxco.com", "password": "Admin@12", "role": "customer"})
    return r.json()["data"]["access_token"]


def _hdr(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.mark.parametrize("collection,min_count", [
    ("payments", 40),
    ("agents", 8),
    ("documents", 55),
    ("bookings", 60),
])
def test_admin_collection_counts(admin_token, collection, min_count):
    r = requests.get(f"{API}/{collection}", headers=_hdr(admin_token))
    assert r.status_code == 200, f"{collection}: {r.text}"
    data = r.json().get("data")
    # Could be paginated dict or list
    items = data.get("items", data) if isinstance(data, dict) else data
    assert isinstance(items, list)
    total = data.get("total") if isinstance(data, dict) else len(items)
    assert total >= min_count, f"{collection}: got {total} expected >= {min_count}"


def test_customer_create_booking(customer_token):
    payload = {
        "service_name": "GST Registration",
        "company": "TEST_ABC Industries",
        "completion_date": "2026-03-01",
        "mode": "online",
        "consultant": "Vikram Singh",
        "fee_estimate": 4999,
        "status": "pending",
        "documents_count": 2,
    }
    r = requests.post(f"{API}/bookings", json=payload, headers=_hdr(customer_token))
    assert r.status_code in (200, 201), r.text
    body = r.json()
    booking = body.get("data", body)
    assert booking.get("service_name") == "GST Registration" or booking.get("company") == "TEST_ABC Industries"


def test_customer_can_list_own_bookings(customer_token):
    r = requests.get(f"{API}/bookings", headers=_hdr(customer_token))
    assert r.status_code == 200
    data = r.json().get("data")
    items = data.get("items", data) if isinstance(data, dict) else data
    assert isinstance(items, list)
    assert len(items) >= 1


def test_admin_synchronization_snapshot(admin_token):
    r = requests.get(f"{API}/admin/synchronization/summary", headers=_hdr(admin_token))
    assert r.status_code == 200, r.text
    payload = r.json().get("data") or {}
    source = payload.get("source_of_truth") or {}
    assert source.get("customer_service") == "erp_customers.service_id / service_type"
    assert source.get("booking_status") == "erp_bookings.status"
    assert source.get("agent_account_status") == "erp_agents.status"
    assert source.get("agent_attendance") == "erp_attendance.status (attendance records; never agent status)"
    assert source.get("invoice_balance") == "erp_invoices.balance derived from invoice total minus eligible payments"


def test_phase6_source_of_truth_endpoint_is_admin_only():
    # The endpoint must never be usable without the authenticated admin boundary.
    r = requests.get(f"{API}/admin/synchronization/summary")
    assert r.status_code in (401, 403)
