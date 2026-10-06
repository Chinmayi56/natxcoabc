"""Customer / booking / service status consistency, counts and drag-drop persistence.

Runs the real FastAPI app in-process on mongomock-motor (pip install mongomock-motor httpx pytest).
Everything is created through the public API; nothing is seeded.

Run:  cd backend && python -m pytest -c /dev/null --rootdir=. tests/test_status_workflow.py
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
os.environ.setdefault("DB_NAME", "ntaxco_status_test")
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
    import asyncio
    email, pw = f"admin-{uuid.uuid4().hex[:6]}@example.com", "AdminPass#123"
    loop = asyncio.new_event_loop()
    loop.run_until_complete(server.db.users.insert_one({
        "id": f"ADMIN-{uuid.uuid4().hex[:6].upper()}", "name": "Test Admin", "email": email, "role": "admin",
        "password_hash": server.hash_password(pw), "status": "active", "meta": {}}))
    r = client.post("/api/auth/admin/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['data']['access_token']}"}


@pytest.fixture(scope="module")
def gst_service(client, admin):
    r = client.post("/api/services", headers=admin, json={
        "name": "GST Registration", "title": "GST Registration", "category": "GST",
        "description": "New GST registration", "final_price": 999, "status": "Active"})
    assert r.status_code == 200, r.text
    return r.json()["data"]


def _customer(client, name, mobile):
    email = f"{name.lower().replace(' ', '.')}.{uuid.uuid4().hex[:5]}@example.com"
    r = client.post("/api/auth/register", json={"full_name": name, "email": email, "password": "CustPass#123",
                                                 "role": "customer", "mobile": mobile})
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    return {"Authorization": f"Bearer {d['access_token']}"}, email


def _cid(client, admin, email):
    return [c for c in client.get("/api/customers", headers=admin).json()["data"] if c.get("email") == email][0]["id"]


def _summary(client, admin):
    return client.get("/api/admin/customers/summary", headers=admin).json()["data"]


def _drop(client, admin, cid, ttype, value):
    return client.post("/api/admin/workflows/drag-drop", headers=admin, json={
        "source_type": "customer", "target_type": ttype, "source_id": cid, "target_value": value})


def test_booking_lifecycle_is_consistent_everywhere(client, admin, gst_service):
    ch, email = _customer(client, "Asha Rao", "9876501234")
    cid = _cid(client, admin, email)

    # Customer books GST Registration -> Pending everywhere
    bk = client.post("/api/bookings", headers=ch, json={
        "service_id": gst_service["id"], "service": gst_service["name"], "email": email,
        "client_request_id": "wf-1"}).json()["data"]
    assert bk["status"] == "Pending"
    cust = client.get(f"/api/customers/{cid}", headers=admin).json()["data"]
    assert cust["filing_status"] == "Pending" and cust["status"] == "Active" and cust["service_type"] == "GST"

    for new, customer_status in (("Running", "Processing"), ("Completed", "Completed")):
        r = client.put(f"/api/bookings/{bk['id']}", headers=admin, json={"status": new})
        assert r.status_code == 200, r.text
        ov = client.get(f"/api/admin/customers/{cid}/overview", headers=admin).json()["data"]
        assert ov["bookings"][0]["status"] == new                      # Customer Details / Booking History
        assert ov["customer"]["filing_status"] == customer_status      # customer status can't contradict it
        assert ov["customer"]["service_type"] == "GST"                 # category untouched
        site = client.get(f"/api/bookings/{bk['id']}", headers=ch).json()["data"]
        assert site["status"] == new                                   # Customer Website
        gst = [g for g in client.get("/api/gst", headers=admin).json()["data"] if g.get("customer_id") == cid]
        assert gst and gst[0]["status"] == new                         # filing record follows the booking

    # website-visible statuses the admin may set
    for st in ("Confirmed", "Processing", "Cancelled", "Pending"):
        assert client.put(f"/api/bookings/{bk['id']}", headers=admin, json={"status": st}).status_code == 200
        assert client.get(f"/api/bookings/{bk['id']}", headers=ch).json()["data"]["status"] == st
    assert client.put(f"/api/bookings/{bk['id']}", headers=admin, json={"status": "Bogus"}).status_code == 400


def test_pending_to_completed_moves_counts_and_cascades(client, admin, gst_service):
    ch, email = _customer(client, "Ravi Kumar", "9876505678")
    cid = _cid(client, admin, email)
    bk = client.post("/api/bookings", headers=ch, json={
        "service_id": gst_service["id"], "service": gst_service["name"], "email": email,
        "client_request_id": "wf-2"}).json()["data"]
    before = _summary(client, admin)
    assert before["total"] == before["paid"] + before["pending"] + before["processing"] + before["completed"] + before["other"]

    r = _drop(client, admin, cid, "payment-status", "Completed")
    assert r.status_code == 200, r.text
    after = _summary(client, admin)
    assert after["pending"] == before["pending"] - 1 and after["completed"] == before["completed"] + 1
    assert after["gst"] == before["gst"] and after["total"] == before["total"]

    cust = client.get(f"/api/customers/{cid}", headers=admin).json()["data"]
    assert cust["filing_status"] == "Completed" and cust["service_type"] == "GST" and cust["status"] == "Active"
    assert client.get(f"/api/bookings/{bk['id']}", headers=ch).json()["data"]["status"] == "Completed"
    ov = client.get(f"/api/admin/customers/{cid}/overview", headers=admin).json()["data"]
    assert ov["bookings"][0]["status"] == "Completed"


def test_drag_drop_category_never_changes_status_and_persists(client, admin, gst_service):
    ch, email = _customer(client, "Meena Iyer", "9876509999")
    cid = _cid(client, admin, email)
    assert _drop(client, admin, cid, "payment-status", "Completed").status_code == 200
    # category drop -> GST; status must stay Completed
    r = _drop(client, admin, cid, "service", gst_service["id"])
    assert r.status_code == 200, r.text
    cust = client.get(f"/api/customers/{cid}", headers=admin).json()["data"]    # a fresh read = "after refresh"
    assert cust["service_type"] == "GST" and cust["filing_status"] == "Completed"
    # and back to Pending keeps the category
    assert _drop(client, admin, cid, "payment-status", "Pending").status_code == 200
    cust = client.get(f"/api/customers/{cid}", headers=admin).json()["data"]
    assert cust["filing_status"] == "Pending" and cust["service_type"] == "GST"
    # frequency drop touches neither
    assert _drop(client, admin, cid, "payment-frequency", "Yearly").status_code == 200
    cust = client.get(f"/api/customers/{cid}", headers=admin).json()["data"]
    assert cust["payment_frequency"] == "Yearly" and cust["filing_status"] == "Pending" and cust["service_type"] == "GST"


def test_workflow_value_sent_as_account_status_is_routed(client, admin):
    ch, email = _customer(client, "Kiran Dev", "9876507777")
    cid = _cid(client, admin, email)
    assert client.put(f"/api/customers/{cid}", headers=admin, json={"status": "Completed"}).status_code == 200
    cust = client.get(f"/api/customers/{cid}", headers=admin).json()["data"]
    assert cust["filing_status"] == "Completed"        # routed to the workflow field
    assert cust["status"] == "Active"                  # account status was not overwritten


def test_failed_update_changes_nothing(client, admin):
    ch, email = _customer(client, "Failing Case", "9876503333")
    cid = _cid(client, admin, email)
    before = _summary(client, admin)
    assert _drop(client, admin, cid, "payment-status", "Bogus").status_code == 400
    assert _drop(client, admin, "NOPE", "payment-status", "Completed").status_code == 404
    assert _summary(client, admin) == before
    assert client.get(f"/api/customers/{cid}", headers=admin).json()["data"]["filing_status"] == "Pending"


def _service(client, admin, name, category, price=500):
    r = client.post("/api/services", headers=admin, json={
        "name": name, "title": name, "category": category, "description": name,
        "final_price": price, "status": "Active"})
    assert r.status_code == 200, r.text
    return r.json()["data"]


def test_category_counts_follow_real_bookings_and_table_rows(client, admin, gst_service):
    """A customer who booked GST *and* Income Tax counts in both cards, and the customers list carries the
    same categories so the table filter shows exactly the customers the card counted."""
    it_service = _service(client, admin, "Tax verification", "Income Tax", 354)
    ch, email = _customer(client, "Ramu Multi", "9876501111")
    cid = _cid(client, admin, email)
    before = _summary(client, admin)
    for i, svc in enumerate((gst_service, it_service)):
        r = client.post("/api/bookings", headers=ch, json={
            "service_id": svc["id"], "service": svc["name"], "email": email, "client_request_id": f"multi-{i}"})
        assert r.status_code == 200, r.text
    after = _summary(client, admin)
    assert after["total"] == before["total"]                       # same customer, no duplicate record
    assert after["gst"] == before["gst"] + 1 and after["income_tax"] == before["income_tax"] + 1

    rows = client.get("/api/customers", headers=admin).json()["data"]
    mine = [r for r in rows if r["id"] == cid][0]
    assert {c.lower() for c in mine["service_categories"]} == {"gst", "income tax"}
    gst_rows = [r for r in rows if "gst" in {c.lower() for c in r.get("service_categories", [])}]
    assert len(gst_rows) == after["gst"]                            # table filter == card count


def test_any_catalog_service_can_be_dropped_by_id(client, admin):
    """Drag/drop works for every service in the live catalog (not just GST/TDS/Income Tax), keeps the
    service's real category, and explains failures instead of returning a bare 500."""
    ch, email = _customer(client, "Catalog Case", "9876502222")
    cid = _cid(client, admin, email)
    for name, cat in (("Accounting Monthly", "Accounting"), ("ROC Annual Filing", "ROC"), ("TDS Return", "TDS")):
        svc = _service(client, admin, name, cat)
        r = _drop(client, admin, cid, "service", svc["id"])
        assert r.status_code == 200, r.text
        cust = client.get(f"/api/customers/{cid}", headers=admin).json()["data"]
        assert cust["service_id"] == svc["id"] and cust["service_type"] == cat
        assert cust["filing_status"] == "Pending" and cust["status"] == "Active"   # status untouched
    r = _drop(client, admin, cid, "service", "SVC-DOES-NOT-EXIST")
    assert r.status_code == 422 and "not found" in str(r.json()["detail"]).lower()


def test_customer_list_pages_cover_every_customer(client, admin):
    total = _summary(client, admin)["total"]
    seen, page = [], 1
    while True:
        body = client.get(f"/api/customers?page={page}&page_size=2", headers=admin).json()
        seen += [r["id"] for r in body["data"]]
        if page >= body["pagination"]["pages"]:
            break
        page += 1
    assert len(seen) == len(set(seen)) == total
