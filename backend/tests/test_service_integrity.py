"""Service integrity: an application/vendor name (e.g. StriveNest) is never a service; real services flow
customer -> booking -> admin customer overview/billing -> Task Board; the admin categories list is real data."""
import asyncio, os, sys, uuid
from pathlib import Path
import pytest

pytest.importorskip("mongomock_motor")
from mongomock_motor import AsyncMongoMockClient  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "ntaxco_service_integrity_test")
os.environ.setdefault("JWT_SECRET", "test-secret-test-secret-test-secret-123")
os.environ.pop("NTAXCO_ENABLE_DEMO_SEED", None)

import motor.motor_asyncio as _motor  # noqa: E402
_motor.AsyncIOMotorClient = lambda *a, **k: AsyncMongoMockClient()

from fastapi.testclient import TestClient  # noqa: E402
import server, erp  # noqa: E402

LOOP = asyncio.new_event_loop()
run = LOOP.run_until_complete
REAL = [("GST Registration", "GST", 3499), ("Income Tax Return", "Income Tax", 1499), ("TDS Return Filing", "TDS", 999),
        ("ROC Annual Filing", "ROC", 5999), ("Accounting Services", "Accounting", 2999), ("Trademark Registration", "Trademark", 4499)]


@pytest.fixture(scope="module")
def client():
    with TestClient(server.app) as c:
        yield c


@pytest.fixture(scope="module")
def admin(client):
    email, pw = f"a-{uuid.uuid4().hex[:6]}@example.com", "AdminPass#123"
    run(server.db.users.insert_one({"id": f"ADMIN-{uuid.uuid4().hex[:6].upper()}", "name": "Admin", "email": email, "role": "admin",
                                    "password_hash": server.hash_password(pw), "status": "active", "meta": {}}))
    r = client.post("/api/auth/admin/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['data']['access_token']}"}


@pytest.fixture(scope="module")
def services(client, admin):
    out = {}
    for name, cat, price in REAL:
        r = client.post("/api/services", headers=admin, json={"name": name, "title": name, "category": cat, "price": price, "final_price": price, "status": "Active"})
        assert r.status_code == 200, r.text
        out[name] = r.json()["data"]
    return out


def _customer(client, name, mobile):
    email = f"{name.lower().replace(' ', '')}.{uuid.uuid4().hex[:5]}@example.com"
    r = client.post("/api/auth/register", json={"full_name": name, "email": email, "password": "CustPass#123", "role": "customer", "mobile": mobile})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['data']['access_token']}"}, email


@pytest.mark.parametrize("bad", ["strivenest", "StriveNest", "Strivenet", "NTAXCO", "Service", "Unknown"])
def test_app_names_cannot_be_created_as_services(client, admin, bad):
    for body in ({"name": bad, "title": bad, "category": "GST"}, {"name": "GST Filing", "title": "GST Filing", "category": bad}):
        r = client.post("/api/services", headers=admin, json=body)
        assert r.status_code == 422, r.text


def test_service_categories_endpoint_lists_real_services_only(client, admin, services):
    run(server.db["erp_services"].insert_one({"id": "SVC-JUNK1", "name": "strivenest", "title": "strivenest", "category": "Others", "status": "Active"}))
    run(server.db["erp_services"].insert_one({"id": "SVC-OFF1", "name": "Old Filing", "title": "Old Filing", "category": "GST", "status": "Inactive"}))
    rows = client.get("/api/admin/service-categories", headers=admin).json()["data"]
    assert [g["category"] for g in rows] == ["GST", "Income Tax", "TDS", "ROC", "Accounting", "Others"]
    by = {g["category"]: [s["name"] for s in g["services"]] for g in rows}
    assert by["GST"] == ["GST Registration"] and by["Income Tax"] == ["Income Tax Return"] and by["TDS"] == ["TDS Return Filing"]
    assert by["ROC"] == ["ROC Annual Filing"] and by["Accounting"] == ["Accounting Services"] and by["Others"] == ["Trademark Registration"]
    assert "strivenest" not in str(rows).lower() and "Old Filing" not in str(rows)
    # not available to customers
    ch, _ = _customer(client, "Cat Viewer", "9500000001")
    assert client.get("/api/admin/service-categories", headers=ch).status_code == 403


def test_junk_record_is_hidden_from_customers_and_cannot_be_booked_or_dropped(client, admin, services):
    ch, email = _customer(client, "Junk Booker", "9500000002")
    me = client.get("/api/auth/me", headers=ch).json()["data"]
    listed = client.get("/api/services", headers=ch).json()["data"]
    assert "strivenest" not in str(listed).lower()
    assert "strivenest" not in str(client.get("/api/public/services").json()).lower()
    bad = {"customer": me["name"], "customer_id": me["id"], "service": "strivenest", "service_id": "SVC-JUNK1", "email": email}
    assert client.post("/api/bookings", headers=ch, json=bad).status_code == 422
    cust = client.get("/api/customers", headers=admin, params={"page_size": 500}).json()["data"]
    some = cust[0]["id"] if cust else None
    if some:
        assert client.post("/api/admin/workflows/drag-drop", headers=admin, json={"source_type": "customer", "target_type": "service", "source_id": some, "target_value": "SVC-JUNK1"}).status_code == 422


def test_quarantine_archives_junk_and_repairs_customer_and_names(client, admin, services):
    ch, email = _customer(client, "Repair Cust", "9500000003")
    me = client.get("/api/auth/me", headers=ch).json()["data"]
    gst = services["GST Registration"]
    bk = client.post("/api/bookings", headers=ch, json={"customer": me["name"], "customer_id": me["id"], "service": gst["title"], "service_id": gst["id"], "email": email, "estimated_fee": 4129}).json()["data"]
    cid = bk["customer_id"]
    # corrupt it the way a bad catalogue record would: customer + booking + task carry the junk label
    run(server.db["erp_customers"].update_one({"id": cid}, {"$set": {"service_id": "SVC-JUNK1", "service_type": "strivenest"}}))
    run(server.db["erp_bookings"].update_one({"id": bk["id"]}, {"$set": {"service": "strivenest"}}))
    summary = run(erp.quarantine_non_service_records(server.db))
    assert "SVC-JUNK1" in summary["archived_services"] or run(server.db["erp_services"].find_one({"id": "SVC-JUNK1"}))["status"] == "Archived"
    c = client.get(f"/api/customers/{cid}", headers=admin).json()["data"]
    assert c["service_type"] == "GST" and c["service_id"] == gst["id"]
    stored = run(server.db["erp_bookings"].find_one({"id": bk["id"]}))
    assert stored["service"] == "GST Registration"
    assert run(erp.quarantine_non_service_records(server.db))["archived_services"] == []   # idempotent


def test_flow_admin_overview_billing_and_task_board_show_the_real_service(client, admin, services):
    expected = {}
    for i, (name, cat, price) in enumerate(REAL):
        ch, email = _customer(client, f"Real Cust {i}", f"96000000{i:02d}")
        me = client.get("/api/auth/me", headers=ch).json()["data"]
        svc = services[name]
        fee = round(price * 1.18)
        r = client.post("/api/bookings", headers=ch, json={"client_request_id": str(uuid.uuid4()), "customer": me["name"], "customer_id": me["id"],
                        "service": svc["title"], "service_id": svc["id"], "email": email, "project_value": price, "estimated_fee": fee, "status": "Pending", "payment_status": "Pending"})
        assert r.status_code == 200, r.text
        bk = r.json()["data"]
        expected[name] = (bk, cat, fee)
        assert client.put(f"/api/bookings/{bk['id']}", headers=admin, json={"status": "Confirmed"}).status_code == 200
    tasks = {t["booking_id"]: t for t in client.get("/api/admin/tasks", headers=admin).json()["data"]}
    buckets = {"GST": "GST", "Income Tax": "Income Tax", "TDS": "TDS", "ROC": "ROC", "Accounting": "Accounting", "Trademark": "Others"}
    for name, (bk, cat, fee) in expected.items():
        ov = client.get(f"/api/admin/customers/{bk['customer_id']}/overview", headers=admin).json()["data"]
        assert [h["service_name"] for h in ov["bookings"]] == [name]
        assert ov["bookings"][0]["service_bucket"] == buckets[cat] and ov["services"][0]["service_bucket"] == buckets[cat]
        bill = client.get(f"/api/admin/customers/{bk['customer_id']}/billing", headers=admin).json()["data"]
        assert bill["total_billed"] == fee and bill["total_paid"] == 0 and bill["outstanding"] == fee   # booking fee counted once
        t = tasks[bk["id"]]
        assert t["service"] == name and "strivenest" not in str(t).lower()
    # booking's own service wins over a stale task service_id
    name = "GST Registration"
    bk = expected[name][0]
    run(server.db["erp_tasks"].update_one({"booking_id": bk["id"]}, {"$set": {"service_id": services["TDS Return Filing"]["id"], "service_name": "TDS Return Filing"}}))
    t = [x for x in client.get("/api/admin/tasks", headers=admin).json()["data"] if x["booking_id"] == bk["id"]][0]
    assert t["service"] == name
