"""Customer booking end-to-end (mongomock-motor, in-process):
login -> /agents (public fields only) -> real service -> POST /bookings (BookServiceModal payload)
-> persisted -> admin sees booking + notification + customer -> accept -> Task Board shows the REAL service."""
import asyncio, os, sys, uuid
from pathlib import Path
import pytest

pytest.importorskip("mongomock_motor")
from mongomock_motor import AsyncMongoMockClient  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "ntaxco_booking_e2e_test")
os.environ.setdefault("JWT_SECRET", "test-secret-test-secret-test-secret-123")
os.environ.pop("NTAXCO_ENABLE_DEMO_SEED", None)

import motor.motor_asyncio as _motor  # noqa: E402
_motor.AsyncIOMotorClient = lambda *a, **k: AsyncMongoMockClient()

from fastapi.testclient import TestClient  # noqa: E402
import server  # noqa: E402

SERVICES = [("GST Registration", "GST"), ("Income Tax Return", "Income Tax"), ("TDS Return Filing", "TDS"), ("ROC Annual Filing", "ROC")]


@pytest.fixture(scope="module")
def client():
    with TestClient(server.app) as c:
        yield c


@pytest.fixture(scope="module")
def admin(client):
    email, pw = f"admin-{uuid.uuid4().hex[:6]}@example.com", "AdminPass#123"
    asyncio.new_event_loop().run_until_complete(server.db.users.insert_one({
        "id": f"ADMIN-{uuid.uuid4().hex[:6].upper()}", "name": "Test Admin", "email": email, "role": "admin",
        "password_hash": server.hash_password(pw), "status": "active", "meta": {}}))
    r = client.post("/api/auth/admin/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['data']['access_token']}"}


@pytest.fixture(scope="module")
def services(client, admin):
    out = {}
    for title, cat in SERVICES:
        r = client.post("/api/services", headers=admin, json={"name": title, "title": title, "category": cat,
                        "description": "x", "final_price": 1999, "status": "Active"})
        assert r.status_code == 200, r.text
        out[title] = r.json()["data"]
    return out


@pytest.fixture(scope="module")
def agents(client, admin):
    ok = client.post("/api/agents", headers=admin, json={"name": "Meera Agent", "email": "meera@example.com", "mobile": "9000000009",
                     "status": "Active", "commission_percentage": 7, "bank_account": "SECRET-123"}).json()["data"]
    off = client.post("/api/agents", headers=admin, json={"name": "Retired Agent", "email": "old@example.com", "mobile": "9000000008",
                      "status": "Inactive", "commission_percentage": 3}).json()["data"]
    return ok, off


def _customer(client, name, mobile):
    email = f"{name.lower().replace(' ', '')}.{uuid.uuid4().hex[:5]}@example.com"
    r = client.post("/api/auth/register", json={"full_name": name, "email": email, "password": "CustPass#123", "role": "customer", "mobile": mobile})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['data']['access_token']}"}, email


def _modal_payload(user, email, service, agent):
    """Mirrors BookServiceModal.confirmCOD()."""
    return {"client_request_id": str(uuid.uuid4()), "customer": user["name"], "customer_id": user["id"],
            "service": service["title"], "service_id": service["id"], "assigned_employee": "",
            "agent_id": agent["id"], "assigned_agent": agent["name"],
            "booking_date": "2026-10-06", "due_date": "", "priority": "Low", "status": "Pending", "payment_status": "Pending",
            "contact_person": user["name"], "email": email, "mobile": user.get("mobile") or "", "gst_number": "", "pan": "",
            "project_name": "", "project_value": 1999, "mode": "Google Meet", "appointment_date": "", "appointment_time": "11:00 AM",
            "notes": "", "description": "", "start_date": "", "turnover": "", "estimated_fee": 2358, "documents": 0}


def test_customer_agents_no_403_and_no_sensitive_data(client, admin, agents):
    ok, off = agents
    ch, _ = _customer(client, "Agent Viewer", "9100000001")
    r = client.get("/api/agents", headers=ch)
    assert r.status_code == 200, r.text
    rows = r.json()["data"]
    assert [a["id"] for a in rows] == [ok["id"]]                       # inactive agent hidden
    assert set(rows[0].keys()) <= {"id", "name", "status"}             # no email/mobile/commission/bank
    assert "SECRET-123" not in r.text and "commission" not in r.text and "meera@example.com" not in r.text
    assert client.get(f"/api/agents/{ok['id']}", headers=ch).json()["data"].keys() <= {"id", "name", "status"}
    assert client.get(f"/api/agents/{off['id']}", headers=ch).status_code == 404
    assert client.get("/api/agents?search=SECRET", headers=ch).json()["data"] == []   # cannot probe hidden fields
    # customers still cannot write agents; unauthenticated is still rejected
    assert client.post("/api/agents", headers=ch, json={"name": "Hack"}).status_code == 403
    assert client.put(f"/api/agents/{ok['id']}", headers=ch, json={"commission_percentage": 99}).status_code == 403
    assert client.delete(f"/api/agents/{ok['id']}", headers=ch).status_code == 403
    assert client.get("/api/agents").status_code in (401, 403)
    # admin still sees full records
    full = client.get("/api/agents", headers=admin).json()["data"]
    assert any(a.get("email") == "meera@example.com" and a.get("commission_percentage") == 7 for a in full)


def test_full_flow_real_service_name_reaches_task_board(client, admin, services, agents):
    ok, _ = agents
    booked = {}
    for i, (title, _cat) in enumerate(SERVICES):
        ch, email = _customer(client, f"Flow Customer {i}", f"92000000{i:02d}")
        me = client.get("/api/auth/me", headers=ch).json()["data"]
        assert client.get("/api/agents", headers=ch).status_code == 200
        svc_rows = client.get("/api/services", headers=ch).json()["data"]
        svc = next(s for s in svc_rows if s["id"] == services[title]["id"])
        payload = _modal_payload(me, email, {"id": svc["id"], "title": svc.get("title") or svc["name"]}, ok)
        r = client.post("/api/bookings", headers=ch, json=payload)
        assert r.status_code == 200, r.text                            # no 422
        bk = r.json()["data"]
        # persisted in the database, with the real service
        stored = asyncio.new_event_loop().run_until_complete(server.db["erp_bookings"].find_one({"id": bk["id"]}, {"_id": 0}))
        assert stored and stored["service"] == title and stored["service_id"] == services[title]["id"]
        assert stored["agent_id"] == ok["id"] and stored["status"] == "Pending"
        booked[title] = bk
        # retry of the same attempt does not duplicate
        assert client.post("/api/bookings", headers=ch, json=payload).json()["data"]["id"] == bk["id"]

    # admin sees the bookings, customers, notifications
    admin_bookings = {b["id"]: b for b in client.get("/api/bookings", headers=admin, params={"page_size": 500}).json()["data"]}
    notes = client.get("/api/notifications", headers=admin).json()["data"]["notifications"]
    for title, bk in booked.items():
        assert admin_bookings[bk["id"]]["service"] == title
        assert any(n.get("booking_id") == bk["id"] and n.get("service_name") == title and title in (n.get("description") or "") for n in notes), title
        cust = client.get(f"/api/customers/{bk['customer_id']}", headers=admin).json()["data"]
        assert cust["service_id"] == services[title]["id"]

    # accept -> task -> Task Board shows the actual booked service (no generic/placeholder/app name)
    for title, bk in booked.items():
        assert client.put(f"/api/bookings/{bk['id']}", headers=admin, json={"status": "Confirmed"}).status_code == 200
    tasks = client.get("/api/admin/tasks", headers=admin).json()["data"]
    for title, bk in booked.items():
        t = [x for x in tasks if x["booking_id"] == bk["id"]]
        assert len(t) == 1
        assert t[0]["service"] == title and title in t[0]["title"] and t[0]["service_name"] == title
    assert not any("strivenet" in str(t).lower() for t in tasks)
    assert len({t["service"] for t in tasks if t["booking_id"] in {b["id"] for b in booked.values()}}) == len(SERVICES)


def test_task_service_falls_back_to_booking_service(client, admin, services):
    """A task with no live service record still shows the booking's real service, never a placeholder."""
    title = SERVICES[0][0]
    ch, email = _customer(client, "Fallback Cust", "9300000001")
    me = client.get("/api/auth/me", headers=ch).json()["data"]
    bk = client.post("/api/bookings", headers=ch, json={"service_id": services[title]["id"], "service": title, "email": email}).json()["data"]
    client.put(f"/api/bookings/{bk['id']}", headers=admin, json={"status": "Confirmed"})
    loop = asyncio.new_event_loop()
    loop.run_until_complete(server.db["erp_tasks"].update_one({"booking_id": bk["id"]}, {"$set": {"service_id": None}, "$unset": {"service_name": ""}}))
    t = [x for x in client.get("/api/admin/tasks", headers=admin).json()["data"] if x["booking_id"] == bk["id"]][0]
    assert t["service"] == title


def test_validation_not_bypassed(client, services, agents):
    ch, email = _customer(client, "Validation Cust", "9400000001")
    me = client.get("/api/auth/me", headers=ch).json()["data"]
    ok, _ = agents
    # a service that does not exist in the database (e.g. the frontend's offline fallback catalogue) is rejected
    bad = _modal_payload(me, email, {"id": "tax-planning", "title": "Tax Planning"}, ok)
    r = client.post("/api/bookings", headers=ch, json=bad)
    assert r.status_code == 422 and "service" in r.json()["detail"].lower()
    # an unknown agent is rejected
    ghost = _modal_payload(me, email, {"id": services["GST Registration"]["id"], "title": "GST Registration"}, {"id": "AG-NOPE", "name": "Ghost"})
    assert client.post("/api/bookings", headers=ch, json=ghost).status_code == 422
    # unauthenticated booking is rejected
    assert client.post("/api/bookings", json=bad).status_code in (401, 403)
