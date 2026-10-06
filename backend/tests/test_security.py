"""NTAXCO ERP Security module tests: Security Overview / Login Activity /
Active Sessions — Super-Admin-only access, login audit trail, and session
lifecycle. Follows the same live-server pattern as test_phase6.py /
backend_test.py (requires REACT_APP_BACKEND_URL pointing at a running
backend + MongoDB)."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"

ADMIN_PASSWORD = "Admin@12"


def _hdr(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def admin_login():
    email = f"security-test-admin-{uuid.uuid4().hex[:6]}@ntaxco.com"
    r = requests.post(f"{API}/auth/admin/login", json={"email": email, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["data"]


@pytest.fixture(scope="module")
def admin_token(admin_login):
    return admin_login["access_token"]


@pytest.fixture(scope="module")
def employee_token():
    email = f"security-test-emp-{uuid.uuid4().hex[:6]}@ntaxco.com"
    r = requests.post(f"{API}/auth/portal/login", json={"email": email, "password": ADMIN_PASSWORD, "role": "employee"})
    assert r.status_code == 200, r.text
    return r.json()["data"]["access_token"]


@pytest.fixture(scope="module")
def customer_token():
    email = f"security-test-cus-{uuid.uuid4().hex[:6]}@ntaxco.com"
    r = requests.post(f"{API}/auth/portal/login", json={"email": email, "password": ADMIN_PASSWORD, "role": "customer"})
    assert r.status_code == 200, r.text
    return r.json()["data"]["access_token"]


# ---------------- authorization ----------------
def test_overview_requires_super_admin(admin_token, employee_token, customer_token):
    assert requests.get(f"{API}/admin/security/overview", headers=_hdr(admin_token)).status_code == 200
    assert requests.get(f"{API}/admin/security/overview", headers=_hdr(employee_token)).status_code == 403
    assert requests.get(f"{API}/admin/security/overview", headers=_hdr(customer_token)).status_code == 403
    assert requests.get(f"{API}/admin/security/overview").status_code == 401


def test_login_activity_requires_super_admin(admin_token, employee_token):
    assert requests.get(f"{API}/admin/security/login-activity", headers=_hdr(admin_token)).status_code == 200
    assert requests.get(f"{API}/admin/security/login-activity", headers=_hdr(employee_token)).status_code == 403


def test_sessions_require_super_admin(admin_token, employee_token):
    assert requests.get(f"{API}/admin/security/sessions", headers=_hdr(admin_token)).status_code == 200
    assert requests.get(f"{API}/admin/security/sessions", headers=_hdr(employee_token)).status_code == 403


def test_non_admin_cannot_terminate_sessions(employee_token):
    r = requests.post(f"{API}/admin/security/sessions/does-not-exist/terminate", headers=_hdr(employee_token))
    assert r.status_code == 403


# ---------------- overview shape ----------------
def test_overview_has_expected_stat_fields(admin_token):
    r = requests.get(f"{API}/admin/security/overview", headers=_hdr(admin_token))
    data = r.json()["data"]
    for key in ("today_logins", "otp_requests", "failed_login_attempts", "active_sessions", "blocked_accounts"):
        assert key in data
        assert isinstance(data[key], int)


# ---------------- audit trail ----------------
def test_successful_password_login_creates_audit(admin_token):
    email = f"security-test-audit-{uuid.uuid4().hex[:6]}@ntaxco.com"
    r = requests.post(f"{API}/auth/portal/login", json={"email": email, "password": ADMIN_PASSWORD, "role": "customer"})
    assert r.status_code == 200
    activity = requests.get(f"{API}/admin/security/login-activity", params={"search": email}, headers=_hdr(admin_token)).json()
    rows = activity["data"]
    assert any(row["email"] == email and row["status"] == "SUCCESS" for row in rows)


def test_failed_password_login_creates_audit(admin_token):
    email = f"security-test-fail-{uuid.uuid4().hex[:6]}@ntaxco.com"
    r = requests.post(f"{API}/auth/portal/login", json={"email": email, "password": "wrong-password", "role": "customer"})
    assert r.status_code == 401
    activity = requests.get(f"{API}/admin/security/login-activity", params={"search": email}, headers=_hdr(admin_token)).json()
    rows = activity["data"]
    assert any(row["email"] == email and row["status"] == "FAILED" and row["failure_reason"] == "INVALID_PASSWORD" for row in rows)


def test_login_activity_mobile_is_masked(admin_token):
    activity = requests.get(f"{API}/admin/security/login-activity", params={"method": "MOBILE_OTP"}, headers=_hdr(admin_token)).json()
    for row in activity["data"]:
        if row.get("mobile_masked"):
            assert "*" in row["mobile_masked"]


def test_logout_creates_logout_event(admin_login, admin_token):
    r = requests.post(f"{API}/auth/logout", headers=_hdr(admin_login["access_token"]))
    assert r.status_code == 200


# ---------------- sessions ----------------
def test_successful_login_creates_active_session(admin_token):
    email = f"security-test-sess-{uuid.uuid4().hex[:6]}@ntaxco.com"
    r = requests.post(f"{API}/auth/portal/login", json={"email": email, "password": ADMIN_PASSWORD, "role": "agent"})
    assert r.status_code == 200
    sessions = requests.get(f"{API}/admin/security/sessions", headers=_hdr(admin_token)).json()["data"]["sessions"]
    assert any(s["status"] == "ACTIVE" for s in sessions)


def test_session_termination_blocks_future_requests():
    email = f"security-test-term-{uuid.uuid4().hex[:6]}@ntaxco.com"
    login = requests.post(f"{API}/auth/portal/login", json={"email": email, "password": ADMIN_PASSWORD, "role": "customer"}).json()["data"]
    token = login["access_token"]

    admin_email = f"security-test-admin2-{uuid.uuid4().hex[:6]}@ntaxco.com"
    admin_tok = requests.post(f"{API}/auth/admin/login", json={"email": admin_email, "password": ADMIN_PASSWORD}).json()["data"]["access_token"]

    sessions = requests.get(f"{API}/admin/security/sessions", headers=_hdr(admin_tok)).json()["data"]["sessions"]
    target = next(s for s in sessions if s["role"] == "customer")

    assert requests.get(f"{API}/auth/me", headers=_hdr(token)).status_code == 200
    term = requests.post(f"{API}/admin/security/sessions/{target['session_id']}/terminate", headers=_hdr(admin_tok))
    assert term.status_code == 200
    assert requests.get(f"{API}/auth/me", headers=_hdr(token)).status_code == 401


# ---------------- pagination & filtering ----------------
def test_login_activity_pagination(admin_token):
    r = requests.get(f"{API}/admin/security/login-activity", params={"page": 1, "limit": 5}, headers=_hdr(admin_token))
    body = r.json()
    assert r.status_code == 200
    assert len(body["data"]) <= 5
    assert body["pagination"]["limit"] == 5


def test_login_activity_filter_by_status(admin_token):
    r = requests.get(f"{API}/admin/security/login-activity", params={"status": "failed"}, headers=_hdr(admin_token))
    for row in r.json()["data"]:
        assert row["status"] == "FAILED"
