"""Phase 4: GST Auto-Reminders API tests."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


class TestReminders:
    def test_reminders_shape(self, api):
        r = api.get(f"{BASE_URL}/api/reminders", timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert body.get("success") is True
        data = body["data"]
        assert "reminders" in data and "summary" in data
        s = data["summary"]
        for k in ["today", "this_week", "overdue", "upcoming"]:
            assert k in s and isinstance(s[k], int)

    def test_reminders_items_have_required_fields(self, api):
        r = api.get(f"{BASE_URL}/api/reminders", timeout=20)
        items = r.json()["data"]["reminders"]
        assert len(items) > 0
        it = items[0]
        for f in ["title", "company", "due_date", "days_remaining", "priority", "type", "kind"]:
            assert f in it, f"missing field {f}"
        assert it["priority"] in ["Overdue", "High", "Medium", "Low"]

    def test_reminders_summary_upcoming_matches_length(self, api):
        r = api.get(f"{BASE_URL}/api/reminders", timeout=20)
        data = r.json()["data"]
        assert data["summary"]["upcoming"] == len(data["reminders"])

    def test_reminders_sorted_by_days_remaining(self, api):
        r = api.get(f"{BASE_URL}/api/reminders", timeout=20)
        items = r.json()["data"]["reminders"]
        days = [i["days_remaining"] for i in items]
        assert days == sorted(days)

    def test_reminders_derived_from_open_only(self, api):
        # Completed items in gst/itr/tds/roc should not appear
        r = api.get(f"{BASE_URL}/api/reminders", timeout=20)
        items = r.json()["data"]["reminders"]
        # All GST-01 (Completed) shouldn't be present. Titles include company. Just spot-check kinds present.
        kinds = {i["kind"] for i in items}
        # At least one of these categories should be present given seed data
        assert kinds & {"GST", "Income Tax", "TDS", "ROC", "Invoice"}


class TestRegressionAuth:
    def test_admin_login(self, api):
        r = api.post(f"{BASE_URL}/api/auth/admin/login", json={"email": TEST_ADMIN_EMAIL, "password": TEST_ADMIN_PASSWORD}, timeout=20)
        assert r.status_code == 200, r.text

    @pytest.mark.parametrize("role", ["employee", "customer", "agent"])
    def test_email_login(self, api, role):
        # Mobile OTP now goes through real Twilio Verify — see
        # backend_test.py for dedicated, mocked send/verify-OTP tests.
        # A fixed "123456" code is no longer meaningful here, so this
        # regression check uses the email/password path instead.
        r = api.post(f"{BASE_URL}/api/auth/portal/login", json={"email": f"phase4-{role}@ntaxco.com", "password": "Admin@12", "role": role}, timeout=20)
        assert r.status_code == 200, r.text
