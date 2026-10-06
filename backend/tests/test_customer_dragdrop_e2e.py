"""End-to-end Admin -> Customers: summary + every drag/drop target (8 category/status + 16 services).

Runs the real FastAPI app in-process on mongomock-motor. Includes deliberately messy "legacy/imported"
customer rows (missing fields, NaN, numeric values) because those - not clean API-created rows - are
what used to turn a drop into a bare 500.

Run:  cd backend && python -m pytest -c /dev/null --rootdir=. tests/test_customer_dragdrop_e2e.py -q
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
os.environ.setdefault("DB_NAME", "ntaxco_dragdrop_e2e")
os.environ.setdefault("JWT_SECRET", "test-secret-test-secret-test-secret-123")
os.environ.pop("NTAXCO_ENABLE_DEMO_SEED", None)

import motor.motor_asyncio as _motor  # noqa: E402
_motor.AsyncIOMotorClient = lambda *a, **k: AsyncMongoMockClient()

from fastapi.testclient import TestClient  # noqa: E402
import server  # noqa: E402

SERVICES = [
    ("GST Registration", "GST"), ("GST Return Filing", "GST"), ("Income Tax Return Filing", "Income Tax"),
    ("TDS Filing", "TDS"), ("ROC Filing", "ROC"), ("Company Registration", "ROC"), ("LLP Registration", "ROC"),
    ("MSME Registration", "Registration"), ("Startup India Registration", "Registration"),
    ("Accounting Services", "Accounting"), ("Payroll Management", "Payroll"), ("Statutory Audit", "Audit"),
    ("Tax Planning", "Income Tax"), ("Trademark Registration", "Legal"), ("Business Consulting", "Consulting"),
    ("Tax verification", "Income Tax"),
]


def run(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@pytest.fixture(scope="module")
def client():
    with TestClient(server.app) as c:
        yield c


@pytest.fixture(scope="module")
def admin(client):
    email, pw = f"admin-{uuid.uuid4().hex[:6]}@example.com", "AdminPass#123"
    run(server.db.users.insert_one({
        "id": f"ADMIN-{uuid.uuid4().hex[:6].upper()}", "name": "Test Admin", "email": email, "role": "admin",
        "password_hash": server.hash_password(pw), "status": "active", "meta": {}}))
    r = client.post("/api/auth/admin/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['data']['access_token']}"}


@pytest.fixture(scope="module")
def services(client, admin):
    out = {}
    for name, cat in SERVICES:
        r = client.post("/api/services", headers=admin, json={
            "name": name, "title": name, "category": cat, "description": name, "final_price": 500, "status": "Active"})
        assert r.status_code == 200, r.text
        out[name] = r.json()["data"]
    return out


@pytest.fixture(scope="module")
def customers(client, admin):
    """Eleven customers: clean API-created ones + messy legacy rows written straight into MongoDB."""
    ids = []
    for i in range(6):
        email = f"cust{i}.{uuid.uuid4().hex[:4]}@example.com"
        r = client.post("/api/customers", headers=admin, json={
            "business_name": f"Clean Biz {i}", "owner": f"Owner {i}", "email": email,
            "mobile": f"98765{i:05d}", "pan": f"ABCDE{i}234F", "status": "Active"})
        assert r.status_code == 200, r.text
        ids.append(r.json()["data"]["id"])
    messy = [
        {"id": "CUS-LEGACY1", "business_name": "Legacy No Status"},                       # almost nothing
        {"id": "CUS-LEGACY2", "business_name": "Legacy NaN", "outstanding": float("nan"), "gst_number": None,
         "service_type": None, "filing_status": None, "status": "Active"},
        {"id": "CUS-LEGACY3", "business_name": "Legacy Numeric", "pan": 12345, "service_type": 7,
         "filing_status": "Paid", "status": "Active", "service_id": 99},
        {"id": "CUS-LEGACY4", "business_name": "Legacy Workflow In Status", "status": "Pending"},
        {"id": "CUS-LEGACY5", "business_name": "Legacy Odd Service", "service_type": "Tax verification",
         "service_id": "SVC-DELETED", "filing_status": "Processing", "status": "Active"},
    ]
    for m in messy:
        run(server.db["erp_customers"].insert_one(dict(m)))
        ids.append(m["id"])
    assert len(ids) == 11
    return ids


def summary(client, admin):
    r = client.get("/api/admin/customers/summary", headers=admin)
    assert r.status_code == 200, r.text
    return r.json()["data"]


def drop(client, admin, cid, ttype, value):
    return client.post("/api/admin/workflows/drag-drop", headers=admin, json={
        "source_type": "customer", "target_type": ttype, "source_id": cid, "target_value": value})


def test_summary_is_live_from_database(client, admin, customers):
    s = summary(client, admin)
    assert s["total"] == len(run(server.db["erp_customers"].find({}).to_list(None)))
    assert s["total"] == s["paid"] + s["pending"] + s["processing"] + s["completed"] + s["other"]
    # customers list (what the table loads) agrees with the summary
    rows = client.get("/api/customers?page=1&page_size=500", headers=admin)
    assert rows.status_code == 200, rows.text
    assert rows.json().get("pagination", {}).get("total", len(rows.json()["data"])) == s["total"]


@pytest.mark.parametrize("cid_index", range(11))
@pytest.mark.parametrize("ttype,value", [
    ("payment-status", "Pending"), ("payment-status", "Processing"), ("payment-status", "Completed"),
    ("payment-frequency", "Yearly"), ("status", "Active"),
])
def test_status_targets_on_every_customer(client, admin, customers, cid_index, ttype, value):
    cid = customers[cid_index]
    r = drop(client, admin, cid, ttype, value)
    assert r.status_code == 200, f"{cid} {ttype}={value}: {r.status_code} {r.text}"
    fresh = run(server.db["erp_customers"].find_one({"id": cid}, {"_id": 0}))
    if ttype == "payment-status":
        assert fresh["filing_status"] == value
    elif ttype == "payment-frequency":
        assert fresh["payment_frequency"] == value
    else:
        assert fresh["status"] == value


@pytest.mark.parametrize("cid_index", range(11))
@pytest.mark.parametrize("svc_name", [n for n, _ in SERVICES])
def test_every_service_target_on_every_customer(client, admin, services, customers, cid_index, svc_name):
    cid, svc = customers[cid_index], services[svc_name]
    r = drop(client, admin, cid, "service", svc["id"])
    assert r.status_code == 200, f"{cid} -> {svc_name}: {r.status_code} {r.text}"
    fresh = run(server.db["erp_customers"].find_one({"id": cid}, {"_id": 0}))
    assert fresh["service_id"] == svc["id"] and fresh["service_type"] == svc["category"]
    # persists on a fresh read through the public API ("after refresh")
    got = client.get(f"/api/customers/{cid}", headers=admin)
    assert got.status_code == 200, got.text
    assert got.json()["data"]["service_id"] == svc["id"]


@pytest.mark.parametrize("label", ["GST", "TDS", "Income Tax"])
def test_category_cards_resolve_to_catalog_service_id(client, admin, services, customers, label):
    """GST / TDS / Income Tax Customer cards: the UI resolves the category to a real catalog service id
    (CustomerManagement.jsx `serviceTargets`) and drops that id - mirror exactly that."""
    live = client.get("/api/services?page=1&page_size=500", headers=admin).json()["data"]
    hit = next(x for x in live if str(x.get("category", "")).strip().lower() == label.lower())
    r = drop(client, admin, customers[0], "service", hit["id"])
    assert r.status_code == 200, r.text
    assert run(server.db["erp_customers"].find_one({"id": customers[0]}))["service_type"] == hit["category"]


def test_summary_counts_move_after_drops(client, admin, services, customers):
    cid = customers[1]
    assert drop(client, admin, cid, "payment-status", "Pending").status_code == 200
    a = summary(client, admin)
    assert drop(client, admin, cid, "payment-status", "Completed").status_code == 200
    b = summary(client, admin)
    assert b["completed"] == a["completed"] + 1 and b["pending"] == a["pending"] - 1 and b["total"] == a["total"]
    assert drop(client, admin, cid, "service", services["GST Registration"]["id"]).status_code in (200,)
    c = summary(client, admin)
    assert c["gst"] >= 1 and c["total"] == a["total"]
