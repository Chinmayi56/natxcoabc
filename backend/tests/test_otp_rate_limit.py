"""Send-OTP guard tests: duplicate collapse, cooldown, window cap, clear 429s.

Runs in-process with mongomock + a fake Twilio client (no SMS is ever sent).
"""
import asyncio
import time
import pytest
from unittest.mock import patch

from test_otp_unit import server, fake_twilio_client, TestClient  # noqa: F401  (sets up mongomock + env)
from otp_guard import otp_send_guard


@pytest.fixture(autouse=True)
def _clean_guard():
    otp_send_guard.reload_config()
    otp_send_guard.reset()
    yield
    otp_send_guard.reload_config()
    otp_send_guard.reset()


@pytest.fixture(scope="module")
def client():
    with TestClient(server.app) as c:
        yield c


def _post(client, mobile, role="customer"):
    return client.post("/api/auth/mobile/send-otp", json={"mobile": mobile, "role": role})


@pytest.mark.parametrize("role", ["customer", "admin"])
def test_first_send_succeeds_for_customer_and_admin(client, role):
    fake, svc = fake_twilio_client()
    with patch.object(server, "get_twilio_client", return_value=fake):
        r = _post(client, "9811100001", role)
    assert r.status_code == 200, r.text
    assert r.json()["success"] is True
    assert "otp" not in r.json()["data"]          # OTP is never returned
    assert svc.verifications.create.call_count == 1


def test_cooldown_blocks_immediate_second_send_with_clear_message(client):
    fake, svc = fake_twilio_client()
    with patch.object(server, "get_twilio_client", return_value=fake):
        assert _post(client, "9811100002").status_code == 200
        r = _post(client, "9811100002")
    assert r.status_code == 429
    detail = r.json()["detail"]
    assert detail["code"] == "OTP_RATE_LIMITED" and detail["reason"] == "cooldown"
    assert 1 <= detail["retry_after"] <= 30
    assert "wait" in detail["message"].lower() and "second" in detail["message"].lower()
    assert r.headers["retry-after"] == str(detail["retry_after"])
    assert svc.verifications.create.call_count == 1   # Twilio was NOT hit again


def test_send_allowed_again_after_cooldown(client, monkeypatch):
    monkeypatch.setattr(otp_send_guard, "cooldown", 1)
    fake, svc = fake_twilio_client()
    with patch.object(server, "get_twilio_client", return_value=fake):
        assert _post(client, "9811100003").status_code == 200
        time.sleep(1.1)
        assert _post(client, "9811100003").status_code == 200
    assert svc.verifications.create.call_count == 2


def test_window_cap_blocks_and_reports_minutes(client, monkeypatch):
    monkeypatch.setattr(otp_send_guard, "cooldown", 0)
    monkeypatch.setattr(otp_send_guard, "max_per_window", 3)
    fake, svc = fake_twilio_client()
    with patch.object(server, "get_twilio_client", return_value=fake):
        for _ in range(3):
            assert _post(client, "9811100004").status_code == 200
        r = _post(client, "9811100004")
    assert r.status_code == 429
    d = r.json()["detail"]
    assert d["reason"] == "mobile_limit" and "minute" in d["message"]
    assert svc.verifications.create.call_count == 3


def test_limits_are_per_mobile(client):
    fake, _ = fake_twilio_client()
    with patch.object(server, "get_twilio_client", return_value=fake):
        assert _post(client, "9811100005").status_code == 200
        assert _post(client, "9811100006").status_code == 200


def test_failed_sends_do_not_consume_quota(client, monkeypatch):
    from twilio.base.exceptions import TwilioRestException
    monkeypatch.setattr(otp_send_guard, "max_per_window", 1)
    err = TwilioRestException(status=500, uri="x", msg="boom", code=20500)
    bad, _ = fake_twilio_client(raise_on_send=err)
    good, svc = fake_twilio_client()
    with patch.object(server, "get_twilio_client", return_value=bad):
        assert _post(client, "9811100007").status_code == 502
        assert _post(client, "9811100007").status_code == 502
    with patch.object(server, "get_twilio_client", return_value=good):
        assert _post(client, "9811100007").status_code == 200


def test_twilio_429_gives_clear_message_and_stops_forwarding(client):
    from twilio.base.exceptions import TwilioRestException
    err = TwilioRestException(status=429, uri="x", msg="limit", code=20429)
    limited, lsvc = fake_twilio_client(raise_on_send=err)
    with patch.object(server, "get_twilio_client", return_value=limited):
        r1 = _post(client, "9811100008")
        r2 = _post(client, "9811100008")
    assert r1.status_code == 429 and r2.status_code == 429
    d = r1.json()["detail"]
    assert d["reason"] == "provider_limit" and "minute" in d["message"]
    assert lsvc.verifications.create.call_count == 1   # second call short-circuited locally


def test_invalid_mobile_and_role_unchanged(client):
    assert _post(client, "12345").status_code == 422
    assert _post(client, "9811100009", "superuser").status_code == 400


def test_concurrent_duplicate_clicks_make_one_twilio_call():
    """Several identical requests in flight at once -> exactly ONE SMS."""
    import httpx

    def slow_create(*a, **kw):
        time.sleep(0.4)
        from test_otp_unit import FakeVerification
        return FakeVerification("pending")

    fake, svc = fake_twilio_client()
    svc.verifications.create.side_effect = slow_create

    async def run():
        transport = httpx.ASGITransport(app=server.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
            return await asyncio.gather(*[
                ac.post("/api/auth/mobile/send-otp", json={"mobile": "9811100010", "role": "customer"})
                for _ in range(4)
            ])

    with patch.object(server, "get_twilio_client", return_value=fake):
        results = asyncio.run(run())

    assert [r.status_code for r in results] == [200, 200, 200, 200], [r.text for r in results]
    assert svc.verifications.create.call_count == 1
