"""NTAXCO ERP Backend Auth Tests"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"
TEST_ADMIN_EMAIL = os.environ.get("NTAXCO_TEST_ADMIN_EMAIL") or os.environ.get("ADMIN_EMAIL") or "chinmayiracharla58@gmail.com"
TEST_ADMIN_PASSWORD = os.environ.get("NTAXCO_TEST_ADMIN_PASSWORD") or os.environ.get("ADMIN_PASSWORD") or "Admin@12"


@pytest.fixture
def s():
    return requests.Session()


# ---- health ----
def test_root(s):
    r = s.get(f"{API}/")
    assert r.status_code == 200
    assert "NTAXCO" in r.json().get("message", "")


# ---- admin email login ----
def test_admin_login_success(s):
    r = s.post(f"{API}/auth/admin/login", json={"email": TEST_ADMIN_EMAIL, "password": TEST_ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["user"]["role"] == "admin"
    assert d["user"]["email"] == TEST_ADMIN_EMAIL
    assert d["access_token"] and d["refresh_token"]


def test_admin_login_wrong_password(s):
    r = s.post(f"{API}/auth/admin/login", json={"email": "chinmayiracharla58@gmail.com", "password": "wrong"})
    assert r.status_code == 401


def test_admin_login_unknown_email(s):
    r = s.post(f"{API}/auth/admin/login", json={"email": "nobody@x.com", "password": TEST_ADMIN_PASSWORD})
    assert r.status_code == 401


# ---- send-otp ----
def test_send_otp_does_not_expose_otp(s):
    # Twilio Verify owns OTP generation. The backend must never return the
    # OTP in API data; live SMS verification is covered by mocked unit tests.
    r = s.post(f"{API}/auth/mobile/send-otp", json={"mobile": "9876543212", "role": "customer"})
    assert r.status_code in (200, 404, 502, 503), r.text
    if r.status_code == 200:
        data = r.json().get("data", {})
        assert "otp" not in data
        assert "otp" not in r.text.lower()


def test_send_otp_invalid_mobile(s):
    r = s.post(f"{API}/auth/mobile/send-otp", json={"mobile": "12345", "role": "employee"})
    assert r.status_code == 422


def test_send_otp_invalid_role(s):
    r = s.post(f"{API}/auth/mobile/send-otp", json={"mobile": "9876543210", "role": "invalid-role"})
    assert r.status_code == 400


# ---- /me, refresh, logout ----
@pytest.fixture
def admin_tokens(s):
    r = s.post(f"{API}/auth/admin/login", json={"email": TEST_ADMIN_EMAIL, "password": TEST_ADMIN_PASSWORD})
    return r.json()["data"]


def test_me_success(s, admin_tokens):
    r = s.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {admin_tokens['access_token']}"})
    assert r.status_code == 200
    assert r.json()["data"]["role"] == "admin"


def test_me_no_token(s):
    r = s.get(f"{API}/auth/me")
    assert r.status_code == 401


def test_me_invalid_token(s):
    r = s.get(f"{API}/auth/me", headers={"Authorization": "Bearer garbage"})
    assert r.status_code == 401


def test_refresh_token(s, admin_tokens):
    r = s.post(f"{API}/auth/refresh", json={"refresh_token": admin_tokens["refresh_token"]})
    assert r.status_code == 200
    assert r.json()["data"]["access_token"]


def test_refresh_with_access_token_rejected(s, admin_tokens):
    r = s.post(f"{API}/auth/refresh", json={"refresh_token": admin_tokens["access_token"]})
    assert r.status_code == 401


def test_logout(s, admin_tokens):
    r = s.post(f"{API}/auth/logout", headers={"Authorization": f"Bearer {admin_tokens['access_token']}"})
    assert r.status_code == 200
