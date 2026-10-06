"""Accepted booking -> exactly one Task Board task; dashboard task analytics (mongomock-motor, in-process)."""
import asyncio, os, sys, uuid
from pathlib import Path
import pytest

pytest.importorskip("mongomock_motor")
from mongomock_motor import AsyncMongoMockClient  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "ntaxco_auto_task_test")
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
    r = client.post("/api/services", headers=admin, json={"name": "GST Monthly Filing", "title": "GST Monthly Filing",
                    "category": "GST", "description": "x", "final_price": 500, "status": "Active"})
    assert r.status_code == 200, r.text
    return r.json()["data"]


@pytest.fixture(scope="module")
def employee(client, admin):
    r = client.post("/api/employees", headers=admin, json={"name": "Ravi Kumar", "email": f"ravi{uuid.uuid4().hex[:4]}@example.com",
                    "mobile": "9000000001", "role": "Consultant", "status": "Active", "password": "RaviPass#123"})
    assert r.status_code == 200, r.text
    return r.json()["data"]


def _booking(client, admin, service, name, mobile, crid):
    email = f"{name.lower()}.{uuid.uuid4().hex[:5]}@example.com"
    r = client.post("/api/auth/register", json={"full_name": name, "email": email, "password": "CustPass#123", "role": "customer", "mobile": mobile})
    assert r.status_code == 200, r.text
    ch = {"Authorization": f"Bearer {r.json()['data']['access_token']}"}
    return client.post("/api/bookings", headers=ch, json={"service_id": service["id"], "service": service["name"], "email": email, "client_request_id": crid}).json()["data"]


def _tasks_for(client, admin, booking_id):
    return [t for t in client.get("/api/admin/tasks", headers=admin).json()["data"] if t.get("booking_id") == booking_id]


def test_no_task_until_accepted_then_exactly_one(client, admin, service):
    bk = _booking(client, admin, service, "Abc", "9876511001", "at-1")
    assert _tasks_for(client, admin, bk["id"]) == []                       # booking alone creates nothing
    for _ in range(3):                                                     # repeated Accept clicks
        r = client.put(f"/api/bookings/{bk['id']}", headers=admin, json={"status": "Confirmed"})
        assert r.status_code == 200, r.text
    tasks = _tasks_for(client, admin, bk["id"])
    assert len(tasks) == 1
    t = tasks[0]
    assert t["status"] == "TO DO" and t["customer_id"] == bk["customer_id"] and t["service_id"] == service["id"]
    assert t["employee_id"] in (None, "") and t["auto_created"] is True    # unassigned: nobody on the booking


def test_assigned_employee_is_reused(client, admin, service, employee):
    bk = _booking(client, admin, service, "Xyz", "9876511002", "at-2")
    r = client.put(f"/api/bookings/{bk['id']}", headers=admin, json={"assigned_employee": "Ravi Kumar"})
    assert r.status_code == 200, r.text
    assert client.put(f"/api/bookings/{bk['id']}", headers=admin, json={"status": "Confirmed"}).status_code == 200
    t = _tasks_for(client, admin, bk["id"])
    assert len(t) == 1 and t[0]["employee_id"] == employee["id"]


def test_status_flow_and_analytics(client, admin, service):
    bk = _booking(client, admin, service, "Flow", "9876511003", "at-3")
    client.put(f"/api/bookings/{bk['id']}", headers=admin, json={"status": "Confirmed"})
    t = _tasks_for(client, admin, bk["id"])[0]
    for st in ("IN PROGRESS", "REVIEW", "COMPLETED"):
        r = client.put(f"/api/admin/tasks/{t['id']}", headers=admin, json={"status": st})
        assert r.status_code == 200, r.text
    s = client.get("/api/admin/tasks/summary", headers=admin).json()["data"]
    assert s["total"] >= 3 and s["completed"] >= 1 and s["unassigned"] >= 1
    a = client.get("/api/admin/tasks/analytics", headers=admin).json()["data"]
    assert sum(x["value"] for x in a["by_status"]) == s["total"]
    assert any(x["name"] == "GST Monthly Filing" for x in a["by_service"])
    assert any(x["name"] == "Unassigned" for x in a["workload"])
    assert a["trend"] and a["trend"][0]["completed"] >= 1
