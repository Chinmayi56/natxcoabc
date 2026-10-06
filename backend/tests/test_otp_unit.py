"""NTAXCO ERP — Mobile OTP / Twilio Verify unit tests.

These run in-process against the real FastAPI app with:
  - MongoDB replaced by mongomock-motor (no real database needed)
  - Twilio replaced by a fake client (no real SMS is ever sent)

This is the "mock Twilio Verify" test coverage called for in Phase 5 —
backend_test.py / test_phase4.py / test_phase6.py are live-server
integration tests and were updated separately to drop their stale
fixed-OTP ("123456") assumptions, since Twilio Verify no longer accepts
a fixed code.

Requires: pip install mongomock-motor
"""
import os
import pytest
from unittest.mock import patch, MagicMock

from mongomock_motor import AsyncMongoMockClient
import motor.motor_asyncio

# Must patch the Mongo client BEFORE importing server, since server.py
# connects to Mongo at import time.
motor.motor_asyncio.AsyncIOMotorClient = lambda *a, **kw: AsyncMongoMockClient()

os.environ.setdefault("JWT_SECRET", "test-secret-not-for-production-use-only")
os.environ.setdefault("DB_NAME", "ntaxco_otp_unit_test")
# Never actually dialled — AsyncIOMotorClient is monkey-patched to the
# in-memory mongomock client above — but server.py requires the env var
# to be present at import time.
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")
os.environ.setdefault("ADMIN_EMAIL", "test-admin@ntaxco.com")
os.environ.setdefault("ADMIN_PASSWORD", "Admin@12")

import server  # noqa: E402
import security  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


class FakeVerification:
    def __init__(self, status="pending"):
        self.status = status


class FakeVerificationCheck:
    def __init__(self, status="approved"):
        self.status = status


class FakeVerifyService:
    """Stands in for twilio_client.verify.v2.services(SID)."""
    def __init__(self, send_status="pending", check_status="approved", raise_on_send=None, raise_on_check=None):
        self.verifications = MagicMock()
        self.verification_checks = MagicMock()
        if raise_on_send:
            self.verifications.create.side_effect = raise_on_send
        else:
            self.verifications.create.return_value = FakeVerification(send_status)
        if raise_on_check:
            self.verification_checks.create.side_effect = raise_on_check
        else:
            self.verification_checks.create.return_value = FakeVerificationCheck(check_status)


def fake_twilio_client(send_status="pending", check_status="approved", raise_on_send=None, raise_on_check=None):
    fake = MagicMock()
    service = FakeVerifyService(send_status, check_status, raise_on_send, raise_on_check)
    fake.verify.v2.services.return_value = service
    return fake, service


@pytest.fixture(scope="module")
def client():
    with TestClient(server.app) as c:
        yield c


# ---------------- pure helper functions: E.164 normalization ----------------
@pytest.mark.parametrize("raw,expected", [
    ("9876543210", "9876543210"),
    ("+919876543210", "9876543210"),
    ("+91 9876543210", "9876543210"),
    ("98765 43210", "9876543210"),
    ("9014564558", "9014564558"),
    ("9440385686", "9440385686"),
    ("8123456789", "8123456789"),
    ("7654321098", "7654321098"),
])
def test_normalize_mobile_various_formats(raw, expected):
    assert server.normalize_mobile(raw) == expected


@pytest.mark.parametrize("mobile", ["9876543210", "9014564558", "9440385686", "8123456789", "7654321098", "6000000000"])
def test_valid_indian_mobiles_accepted(mobile):
    assert server.is_valid_indian_mobile(mobile) is True
    assert server.to_e164_india(mobile) == f"+91{mobile}"


@pytest.mark.parametrize("mobile", ["12345", "1234567890", "99999", "0876543210", "98765432100"])
def test_invalid_indian_mobiles_rejected(mobile):
    assert server.is_valid_indian_mobile(mobile) is False


def test_e164_conversion_is_generic_not_hardcoded():
    # Confirms conversion is a pure function of the input digits, not tied
    # to any specific number.
    for mobile in ("9876543210", "9014564558", "6111122223"):
        assert server.to_e164_india(mobile) == f"+91{mobile}"


# ---------------- send-otp: format validation (no Twilio call needed) ----------------
def test_send_otp_invalid_mobile_returns_422(client):
    r = client.post("/api/auth/mobile/send-otp", json={"mobile": "12345", "role": "customer"})
    assert r.status_code == 422


def test_send_otp_invalid_role_returns_400(client):
    r = client.post("/api/auth/mobile/send-otp", json={"mobile": "9876543210", "role": "superuser"})
    assert r.status_code == 400


# ---------------- send-otp: mocked Twilio ----------------
def test_send_otp_success_calls_twilio_with_e164(client):
    mobile = "9876500001"
    fake_client, service = fake_twilio_client(send_status="pending")
    with patch.object(server, "get_twilio_client", return_value=fake_client):
        r = client.post("/api/auth/mobile/send-otp", json={"mobile": mobile, "role": "customer"})
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    # OTP itself must never be present in the response.
    assert "otp" not in data
    called_to = service.verifications.create.call_args.kwargs.get("to") or service.verifications.create.call_args.args[0]
    assert called_to == f"+91{mobile}"


def test_send_otp_twilio_failure_returns_502(client):
    from twilio.base.exceptions import TwilioRestException
    err = TwilioRestException(status=500, uri="x", msg="boom", code=99999)
    fake_client, _ = fake_twilio_client(raise_on_send=err)
    with patch.object(server, "get_twilio_client", return_value=fake_client):
        r = client.post("/api/auth/mobile/send-otp", json={"mobile": "9876500002", "role": "customer"})
    assert r.status_code == 502


def test_send_otp_twilio_rate_limited_returns_429(client):
    from twilio.base.exceptions import TwilioRestException
    err = TwilioRestException(status=429, uri="x", msg="rate limited", code=20429)
    fake_client, _ = fake_twilio_client(raise_on_send=err)
    with patch.object(server, "get_twilio_client", return_value=fake_client):
        r = client.post("/api/auth/mobile/send-otp", json={"mobile": "9876500003", "role": "customer"})
    assert r.status_code == 429


# ---------------- verify-otp: mocked Twilio ----------------
def test_verify_otp_success_issues_jwt_and_creates_new_user(client):
    mobile = "9876500010"
    fake_client, _ = fake_twilio_client(check_status="approved")
    with patch.object(server, "get_twilio_client", return_value=fake_client):
        r = client.post("/api/auth/mobile/verify-otp", json={"mobile": mobile, "otp": "999111", "role": "customer"})
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["access_token"]
    assert data["user"]["role"] == "customer"
    assert data["user"]["mobile"] == mobile  # the user's own login response legitimately includes their own mobile
    # The OTP code itself must never appear anywhere in the response.
    assert "999111" not in r.text


def test_verify_otp_denied_returns_401(client):
    mobile = "9876500011"
    fake_client, _ = fake_twilio_client(check_status="denied")
    with patch.object(server, "get_twilio_client", return_value=fake_client):
        r = client.post("/api/auth/mobile/verify-otp", json={"mobile": mobile, "otp": "000000", "role": "customer"})
    assert r.status_code == 401


def test_verify_otp_twilio_404_is_expired(client):
    from twilio.base.exceptions import TwilioRestException
    err = TwilioRestException(status=404, uri="x", msg="not found", code=20404)
    fake_client, _ = fake_twilio_client(raise_on_check=err)
    with patch.object(server, "get_twilio_client", return_value=fake_client):
        r = client.post("/api/auth/mobile/verify-otp", json={"mobile": "9876500012", "otp": "111222", "role": "customer"})
    assert r.status_code == 401
    assert "expired" in r.json()["detail"].lower()


def test_verify_otp_unknown_admin_mobile_rejected(client):
    """Twilio proving a phone received an SMS must never be enough to
    mint a brand-new Super Admin account."""
    fake_client, _ = fake_twilio_client(check_status="approved")
    with patch.object(server, "get_twilio_client", return_value=fake_client):
        r = client.post("/api/auth/mobile/verify-otp", json={"mobile": "9876500099", "otp": "123123", "role": "admin"})
    assert r.status_code == 403


def test_no_fixed_otp_bypass_exists(client):
    """The one-time historical '123456' fixed code must not be
    special-cased anywhere in the verify path — Twilio's real check
    result is what decides, every time."""
    fake_client, _ = fake_twilio_client(check_status="denied")
    with patch.object(server, "get_twilio_client", return_value=fake_client):
        r = client.post("/api/auth/mobile/verify-otp", json={"mobile": "9876500098", "otp": "123456", "role": "customer"})
    assert r.status_code == 401


# ---------------- role independence from mobile number ----------------
def test_same_mobile_different_roles_are_independent_accounts(client):
    mobile = "9876500020"
    fake_client, _ = fake_twilio_client(check_status="approved")
    with patch.object(server, "get_twilio_client", return_value=fake_client):
        r1 = client.post("/api/auth/mobile/verify-otp", json={"mobile": mobile, "otp": "555555", "role": "customer"})
        r2 = client.post("/api/auth/mobile/verify-otp", json={"mobile": mobile, "otp": "555555", "role": "agent"})
    assert r1.status_code == 200 and r2.status_code == 200
    assert r1.json()["data"]["user"]["role"] == "customer"
    assert r2.json()["data"]["user"]["role"] == "agent"
    assert r1.json()["data"]["user"]["id"] != r2.json()["data"]["user"]["id"]
