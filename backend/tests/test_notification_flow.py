"""End-to-end Customer -> Booking -> Admin Notification -> Admin Customer flow.

Runs the REAL FastAPI app in-process against an in-memory MongoDB emulator
(mongomock-motor) so it needs no server. It creates NO demo data in the
project: every record below is created through the public API during the test
and discarded with the in-memory database.
"""
import os
import sys
import uuid
from pathlib import Path

import pytest

pytest.importorskip("mongomock_motor")
from mongomock_motor import AsyncMongoMockClient  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "ntaxco_flow_test")
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
def admin_headers(client):
    import asyncio
    email, pw = f"admin-{uuid.uuid4().hex[:6]}@example.com", "AdminPass#123"
    loop = asyncio.new_event_loop()
    loop.run_until_complete(server.db.users.insert_one({
        "id": f"ADMIN-{uuid.uuid4().hex[:6].upper()}", "name": "Test Admin", "email": email, "role": "admin",
        "password_hash": server.hash_password(pw), "status": "active", "meta": {},
    }))
    r = client.post("/api/auth/admin/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['data']['access_token']}"}


@pytest.fixture(scope="module")
def service(client, admin_headers):
    r = client.post("/api/services", headers=admin_headers, json={
        "name": "Income Tax Return Filing", "title": "Income Tax Return Filing", "category": "Income Tax",
        "description": "Annual ITR filing", "final_price": 1499, "status": "Active"})
    assert r.status_code == 200, r.text
    return r.json()["data"]


def _register(client, name, mobile):
    email = f"{name.lower().replace(' ', '.')}.{uuid.uuid4().hex[:5]}@example.com"
    r = client.post("/api/auth/register", json={"full_name": name, "email": email, "password": "CustPass#123",
                                                 "role": "customer", "mobile": mobile})
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    return d["user"], {"Authorization": f"Bearer {d['access_token']}"}, email


def _unread(client, h):
    return client.get("/api/notifications/unread-count", headers=h).json()["data"]["unread"]


def test_full_flow(client, admin_headers, service):
    base_unread = _unread(client, admin_headers)

    # --- registration -> CUSTOMER_REGISTERED notification -------------------
    user, ch, email = _register(client, "John Doe", "9876543210")
    assert _unread(client, admin_headers) == base_unread + 1
    notes = client.get("/api/notifications", headers=admin_headers).json()["data"]["notifications"]
    reg = [n for n in notes if n.get("kind") == "CUSTOMER_REGISTERED"]
    assert len(reg) == 1 and reg[0]["title"] == "New customer registered" and reg[0]["read"] is False
    customers = client.get("/api/customers", headers=admin_headers).json()["data"]
    mine = [c for c in customers if c.get("email") == email]
    assert len(mine) == 1                      # exactly one customer record, no duplicates
    cid = mine[0]["id"]
    assert reg[0]["customer_id"] == cid

    # --- booking -> SERVICE_BOOKING notification ----------------------------
    payload = {"service_id": service["id"], "service": service["name"], "notes": "Please file FY 25-26",
               "mobile": "9876543210", "email": email, "client_request_id": "req-1"}
    r = client.post("/api/bookings", headers=ch, json=payload)
    assert r.status_code == 200, r.text
    bk = r.json()["data"]
    assert bk["customer_id"] == cid and bk["status"] == "Pending"
    assert _unread(client, admin_headers) == base_unread + 2

    # --- duplicate submit (network retry) must not duplicate -----------------
    r2 = client.post("/api/bookings", headers=ch, json=payload)
    assert r2.status_code == 200 and r2.json()["data"]["id"] == bk["id"]
    assert _unread(client, admin_headers) == base_unread + 2
    # ...but a legitimate second booking (new request id) is created
    r3 = client.post("/api/bookings", headers=ch, json={**payload, "client_request_id": "req-2"})
    assert r3.json()["data"]["id"] != bk["id"]
    assert _unread(client, admin_headers) == base_unread + 3

    # --- notification list + detail ------------------------------------------
    notes = client.get("/api/notifications", headers=admin_headers).json()["data"]["notifications"]
    bn = [n for n in notes if n.get("booking_id") == bk["id"] and n.get("kind") == "SERVICE_BOOKING"]
    assert len(bn) == 1
    n = bn[0]
    assert n["customer_name"] == "John Doe" and n["service_name"] == "Income Tax Return Filing"
    d = client.get(f"/api/notifications/{n['id']}", headers=admin_headers).json()["data"]
    assert d["customer"]["id"] == cid and d["customer"]["mobile"]
    assert d["booking"]["id"] == bk["id"] and d["booking"]["status"] == "Pending"
    assert d["service"]["id"] == service["id"] and d["service"]["category"] == "Income Tax"

    # --- read status: only the opened one flips, with read_at ----------------
    before = _unread(client, admin_headers)
    assert client.post(f"/api/notifications/{n['id']}/read", headers=admin_headers).status_code == 200
    assert _unread(client, admin_headers) == before - 1
    d2 = client.get(f"/api/notifications/{n['id']}", headers=admin_headers).json()["data"]["notification"]
    assert d2["is_read"] is True and d2["read_at"]

    # --- admin customer module: services + history (newest first) ------------
    ov = client.get(f"/api/admin/customers/{cid}/overview", headers=admin_headers).json()["data"]
    assert ov["booking_count"] == 2 and ov["bookings"][0]["booking_id"] == r3.json()["data"]["id"]
    assert ov["services"][0]["id"] == service["id"]
    assert ov["bookings"][1]["service_category"] == "Income Tax"

    # --- status change persists and shows on the customer ------------------
    up = client.put(f"/api/bookings/{bk['id']}", headers=admin_headers, json={"status": "Confirmed"})
    assert up.status_code == 200
    ov = client.get(f"/api/admin/customers/{cid}/overview", headers=admin_headers).json()["data"]
    assert {b["booking_id"]: b["status"] for b in ov["bookings"]}[bk["id"]] == "Confirmed"
    assert client.put(f"/api/bookings/{bk['id']}", headers=admin_headers, json={"status": "Bogus"}).status_code == 400

    # --- exact notification wording uses the real booking data ---------------
    assert n["title"] == f"New booking {bk['id']} received"
    assert n["description"] == f"John Doe requested {service['name']}. Priority: {bk.get('priority') or 'Low'}."
    assert bk["booking_no"] == bk["id"]

    # --- status change -> admin notification linked to the same booking ------
    client.put(f"/api/bookings/{bk['id']}", headers=admin_headers, json={"status": "Running"})
    notes = client.get("/api/notifications", headers=admin_headers).json()["data"]["notifications"]
    sn = [x for x in notes if x.get("kind") == "BOOKING_STATUS" and x.get("booking_id") == bk["id"] and x["title"].endswith("Running")]
    assert len(sn) == 1 and sn[0]["description"] == f"Admin updated booking {bk['id']} to Running."
    assert sn[0]["customer_id"] == cid
    # same status again must not create a second notification
    client.put(f"/api/bookings/{bk['id']}", headers=admin_headers, json={"status": "Running"})
    notes = client.get("/api/notifications", headers=admin_headers).json()["data"]["notifications"]
    assert len([x for x in notes if x.get("kind") == "BOOKING_STATUS" and x["title"].endswith("Running") and x.get("booking_id") == bk["id"]]) == 1

    # --- mark all read persists in the database ------------------------------
    assert client.post("/api/notifications/read-all", headers=admin_headers).status_code == 200
    assert _unread(client, admin_headers) == 0
    notes = client.get("/api/notifications", headers=admin_headers).json()["data"]["notifications"]
    assert all(x["read"] for x in notes) and len(notes) >= 5


def test_security_and_errors(client, admin_headers, service):
    _, ch_a, email_a = _register(client, "Alice A", "9123456780")
    _, ch_b, _ = _register(client, "Bob B", "9123456781")
    ba = client.post("/api/bookings", headers=ch_a, json={"service_id": service["id"], "service": service["name"]}).json()["data"]
    # customer cannot hit admin notification / overview endpoints' linked data
    cust_notes = client.get("/api/notifications", headers=ch_b).json()["data"]["notifications"]
    assert all(n.get("kind") != "SERVICE_BOOKING" for n in cust_notes)
    assert client.get(f"/api/admin/customers/{ba['customer_id']}/overview", headers=ch_b).status_code == 403
    # Bob cannot read Alice's booking, and a spoofed customer_id is ignored
    assert client.get(f"/api/bookings/{ba['id']}", headers=ch_b).status_code in (403, 404)
    spoof = client.post("/api/bookings", headers=ch_b, json={"service_id": service["id"], "customer_id": ba["customer_id"]})
    assert spoof.json()["data"]["customer_id"] != ba["customer_id"]
    # no token / invalid service / unknown ids
    assert client.get("/api/notifications/unread-count").status_code in (401, 403)
    assert client.post("/api/bookings", headers=ch_a, json={"service_id": "SVC-NOPE", "service": "Nope"}).status_code == 422
    assert client.get("/api/notifications/NTF-NOPE", headers=admin_headers).status_code == 404
    assert client.post("/api/notifications/NTF-NOPE/read", headers=admin_headers).status_code == 404
    assert client.get("/api/admin/customers/CUS-NOPE/overview", headers=admin_headers).status_code == 404
    # failed booking created no notification
    notes = client.get("/api/notifications", headers=admin_headers).json()["data"]["notifications"]
    assert not any(n.get("service_name") == "Nope" for n in notes)


def test_notification_failure_does_not_corrupt_booking(client, admin_headers, service, monkeypatch):
    import erp
    _, ch, _ = _register(client, "Carol C", "9123456782")

    async def boom(*a, **k):
        raise RuntimeError("notification store down")
    monkeypatch.setattr(erp, "create_notification", boom)
    r = client.post("/api/bookings", headers=ch, json={"service_id": service["id"], "service": service["name"]})
    assert r.status_code == 200                       # booking persisted and returned
    bid = r.json()["data"]["id"]
    assert client.get(f"/api/bookings/{bid}", headers=ch).status_code == 200


def test_login_notification_is_opt_in(client, admin_headers, monkeypatch):
    _, ch, email = _register(client, "Dave D", "9123456783")
    before = _unread(client, admin_headers)
    assert client.post("/api/auth/portal/login", json={"email": email, "password": "CustPass#123", "role": "customer"}).status_code == 200
    assert _unread(client, admin_headers) == before            # default: no login spam
    monkeypatch.setenv("NTAXCO_NOTIFY_CUSTOMER_LOGIN", "true")
    assert client.post("/api/auth/portal/login", json={"email": email, "password": "CustPass#123", "role": "customer"}).status_code == 200
    assert _unread(client, admin_headers) == before + 1
    n = client.get("/api/notifications", headers=admin_headers).json()["data"]["notifications"]
    assert any(x.get("kind") == "CUSTOMER_LOGIN" for x in n)
