"""Admin-controlled booking status: persistence, customer read-only, notifications, audit.

Runs the real FastAPI app in-process on mongomock-motor (pip install mongomock-motor httpx pytest).
Run:  cd backend && python -m pytest -c /dev/null --rootdir=. tests/test_booking_status_admin.py
"""
import asyncio
import os
import sys
import uuid
from pathlib import Path

import pytest

pytest.importorskip("mongomock_motor")
from mongomock_motor import AsyncMongoMockClient  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "ntaxco_booking_status_test")
os.environ.setdefault("JWT_SECRET", "test-secret-test-secret-test-secret-123")
os.environ.pop("NTAXCO_ENABLE_DEMO_SEED", None)

import motor.motor_asyncio as _motor  # noqa: E402
_motor.AsyncIOMotorClient = lambda *a, **k: AsyncMongoMockClient()

from fastapi.testclient import TestClient  # noqa: E402
import server  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(server.app) as c:
        yield c


@pytest.fixture(scope="module")
def admin(client):
    email, pw = f"admin-{uuid.uuid4().hex[:6]}@example.com", "AdminPass#123"
    loop = asyncio.new_event_loop()
    loop.run_until_complete(server.db.users.insert_one({
        "id": f"ADMIN-{uuid.uuid4().hex[:6].upper()}", "name": "Test Admin", "email": email, "role": "admin",
        "password_hash": server.hash_password(pw), "status": "active", "meta": {}}))
    r = client.post("/api/auth/admin/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['data']['access_token']}"}


@pytest.fixture(scope="module")
def service(client, admin):
    r = client.post("/api/services", headers=admin, json={
        "name": "Tax verification", "title": "Tax verification", "category": "Income Tax",
        "description": "Verification", "final_price": 500, "status": "Active"})
    assert r.status_code == 200, r.text
    return r.json()["data"]


def _customer(client, name, mobile):
    email = f"{name.lower()}.{uuid.uuid4().hex[:5]}@example.com"
    r = client.post("/api/auth/register", json={"full_name": name, "email": email, "password": "CustPass#123",
                                                 "role": "customer", "mobile": mobile})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['data']['access_token']}"}, email


def _setup(client, admin, service, name, mobile, crid):
    ch, email = _customer(client, name, mobile)
    cid = [c for c in client.get("/api/customers", headers=admin).json()["data"] if c.get("email") == email][0]["id"]
    bk = client.post("/api/bookings", headers=ch, json={"service_id": service["id"], "service": service["name"],
                                                        "email": email, "client_request_id": crid}).json()["data"]
    return ch, cid, bk


def test_admin_status_flow_is_visible_everywhere(client, admin, service):
    ch, cid, bk = _setup(client, admin, service, "Ramu", "9876500001", "bs-1")
    assert bk["status"] == "Pending"
    for new in ("Processing", "Completed"):
        r = client.put(f"/api/bookings/{bk['id']}", headers=admin, json={"status": new})
        assert r.status_code == 200, r.text
        assert r.json()["data"]["status"] == new and r.json()["data"].get("status_updated_at")
        ov = client.get(f"/api/admin/customers/{cid}/overview", headers=admin).json()["data"]
        assert ov["bookings"][0]["status"] == new                               # Booking History
        assert [s for s in ov["services"] if s["id"] == service["id"]][0]["status"] == new   # service card
        assert [b for b in client.get("/api/bookings", headers=admin).json()["data"] if b["id"] == bk["id"]][0]["status"] == new  # Bookings module
        assert [b for b in client.get("/api/bookings", headers=ch).json()["data"] if b["id"] == bk["id"]][0]["status"] == new      # Customer site
    cust = client.get(f"/api/customers/{cid}", headers=admin).json()["data"]
    assert cust["filing_status"] == "Completed"


def test_cancelled_is_persisted_visible_and_not_deleted(client, admin, service):
    ch, cid, bk = _setup(client, admin, service, "Sita", "9876500002", "bs-2")
    assert client.put(f"/api/bookings/{bk['id']}", headers=admin, json={"status": "Cancelled"}).status_code == 200
    ov = client.get(f"/api/admin/customers/{cid}/overview", headers=admin).json()["data"]
    assert ov["booking_count"] == 1 and ov["bookings"][0]["status"] == "Cancelled"
    assert [s for s in ov["services"] if s["id"] == service["id"]][0]["status"] == "Cancelled"
    assert client.get(f"/api/bookings/{bk['id']}", headers=ch).json()["data"]["status"] == "Cancelled"
    assert ov["customer"]["filing_status"] != "Completed"


def test_customer_cannot_change_status_and_arbitrary_text_is_rejected(client, admin, service):
    ch, cid, bk = _setup(client, admin, service, "Gita", "9876500003", "bs-3")
    r = client.put(f"/api/bookings/{bk['id']}", headers=ch, json={"status": "Completed"})
    assert r.status_code == 403, r.text
    assert client.get(f"/api/bookings/{bk['id']}", headers=admin).json()["data"]["status"] == "Pending"
    assert client.put(f"/api/bookings/{bk['id']}", headers=admin, json={"status": "Done-ish"}).status_code == 400


def test_notification_goes_only_to_owner_and_not_duplicated_on_retry(client, admin, service):
    ch, cid, bk = _setup(client, admin, service, "Hari", "9876500004", "bs-4")
    other, _, _ = _setup(client, admin, service, "Uma", "9876500005", "bs-5")
    assert client.put(f"/api/bookings/{bk['id']}", headers=admin, json={"status": "Processing"}).status_code == 200
    assert client.put(f"/api/bookings/{bk['id']}", headers=admin, json={"status": "Processing"}).status_code == 200  # retry
    def mine(h):
        rows = client.get("/api/notifications", headers=h).json()
        rows = rows.get("data", rows) if isinstance(rows, dict) else rows
        return [n for n in rows if bk["id"] in str(n.get("title", "")) and "Processing" in str(n.get("description", n.get("message", "")))]
    assert len(mine(ch)) == 1
    assert len(mine(other)) == 0


def test_audit_records_old_and_new_status_and_actor(client, admin, service):
    ch, cid, bk = _setup(client, admin, service, "Mani", "9876500006", "bs-6")
    assert client.put(f"/api/bookings/{bk['id']}", headers=admin, json={"status": "Processing"}).status_code == 200
    loop = asyncio.new_event_loop()
    rec = loop.run_until_complete(server.db["erp_audit_logs"].find_one({"action": "booking_status_change", "item_id": bk["id"]}, {"_id": 0}))
    assert rec and rec["changes"]["old_status"] == "Pending" and rec["changes"]["new_status"] == "Processing"
    assert rec["role"] == "admin" and rec["user_id"] and rec["ts"]
