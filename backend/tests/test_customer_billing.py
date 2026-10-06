"""Customer billing (Total Billed / Total Paid / Outstanding) + admin status -> customer website.

Runs the real FastAPI app in-process on mongomock-motor (pip install mongomock-motor httpx pytest).
Run:  cd backend && python -m pytest -c /dev/null --rootdir=. tests/test_customer_billing.py
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
os.environ.setdefault("DB_NAME", "ntaxco_billing_test")
os.environ.setdefault("JWT_SECRET", "test-secret-test-secret-test-secret-123")
os.environ.pop("NTAXCO_ENABLE_DEMO_SEED", None)

import motor.motor_asyncio as _motor  # noqa: E402
_motor.AsyncIOMotorClient = lambda *a, **k: AsyncMongoMockClient()

from fastapi.testclient import TestClient  # noqa: E402
import server  # noqa: E402

LOOP = asyncio.new_event_loop()


@pytest.fixture(scope="module")
def client():
    with TestClient(server.app) as c:
        yield c


@pytest.fixture(scope="module")
def admin(client):
    email, pw = f"admin-{uuid.uuid4().hex[:6]}@example.com", "AdminPass#123"
    LOOP.run_until_complete(server.db.users.insert_one({
        "id": f"ADMIN-{uuid.uuid4().hex[:6].upper()}", "name": "Test Admin", "email": email, "role": "admin",
        "password_hash": server.hash_password(pw), "status": "active", "meta": {}}))
    r = client.post("/api/auth/admin/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['data']['access_token']}"}


def _service(client, admin, name, price):
    r = client.post("/api/services", headers=admin, json={
        "name": name, "title": name, "category": "GST", "description": name, "final_price": price, "status": "Active"})
    assert r.status_code == 200, r.text
    return r.json()["data"]


def _customer(client, admin, name, mobile):
    email = f"{name.lower()}.{uuid.uuid4().hex[:5]}@example.com"
    r = client.post("/api/auth/register", json={"full_name": name, "email": email, "password": "CustPass#123",
                                                 "role": "customer", "mobile": mobile})
    assert r.status_code == 200, r.text
    headers = {"Authorization": f"Bearer {r.json()['data']['access_token']}"}
    cid = [c for c in client.get("/api/customers", headers=admin).json()["data"] if c.get("email") == email][0]["id"]
    return headers, cid, email


def _book(client, headers, svc, email):
    r = client.post("/api/bookings", headers=headers, json={
        "service_id": svc["id"], "service": svc["name"], "email": email, "client_request_id": uuid.uuid4().hex})
    assert r.status_code == 200, r.text
    return r.json()["data"]


def _billing(client, admin, cid):
    r = client.get(f"/api/admin/customers/{cid}/billing", headers=admin)
    assert r.status_code == 200, r.text
    return r.json()["data"]


def _pay(client, admin, cid, amount, **extra):
    body = {"customer_id": cid, "amount": amount, "status": "Completed", "payment_method": "UPI", **extra}
    return client.post("/api/payments", headers=admin, json=body)


@pytest.fixture(scope="module")
def world(client, admin):
    s4129 = _service(client, admin, "Service 4129", 4129)
    s2500 = _service(client, admin, "Service 2500", 2500)
    s1000 = _service(client, admin, "Service 1000", 1000)
    a_h, a, a_mail = _customer(client, admin, "Alpha", "9000000001")
    b_h, b, b_mail = _customer(client, admin, "Bravo", "9000000002")
    c_h, c, c_mail = _customer(client, admin, "Charlie", "9000000003")
    bk_a = _book(client, a_h, s4129, a_mail)
    bk_b = _book(client, b_h, s2500, b_mail)
    bk_c1 = _book(client, c_h, s4129, c_mail)
    bk_c2 = _book(client, c_h, s1000, c_mail)
    bk_c3 = _book(client, c_h, s2500, c_mail)  # will be cancelled -> not billable
    assert client.put(f"/api/bookings/{bk_c3['id']}", headers=admin, json={"status": "Cancelled"}).status_code == 200
    return dict(a=a, b=b, c=c, a_h=a_h, b_h=b_h, c_h=c_h, bk_a=bk_a, bk_b=bk_b, bk_c1=bk_c1, bk_c2=bk_c2, bk_c3=bk_c3,
                s4129=s4129, s2500=s2500, s1000=s1000)


def test_each_customer_gets_their_own_billed_total(client, admin, world):
    a, b, c = (_billing(client, admin, world[k]) for k in ("a", "b", "c"))
    assert a["total_billed"] == 4129.0
    assert b["total_billed"] == 2500.0
    assert c["total_billed"] == 5129.0            # 4129 + 1000, the cancelled 2500 booking is ignored
    assert c["ignored"]["cancelled_bookings"] == 1
    assert len({a["total_billed"], b["total_billed"], c["total_billed"]}) == 3
    for x in (a, b, c):
        assert x["total_paid"] == 0 and x["outstanding"] == x["total_billed"]


def test_payment_updates_paid_and_outstanding_for_that_customer_only(client, admin, world):
    r = _pay(client, admin, world["a"], 1000, reference_no="UTR-A-1", payment_date="2026-10-05")
    assert r.status_code == 200, r.text
    a, b = _billing(client, admin, world["a"]), _billing(client, admin, world["b"])
    assert (a["total_billed"], a["total_paid"], a["outstanding"]) == (4129.0, 1000.0, 3129.0)
    assert (b["total_billed"], b["total_paid"], b["outstanding"]) == (2500.0, 0.0, 2500.0)
    # outstanding is exactly billed - paid
    assert a["outstanding"] == round(a["total_billed"] - a["total_paid"], 2)


def test_duplicate_payments_are_not_counted_twice(client, admin, world):
    # same reference for the same customer is rejected
    assert _pay(client, admin, world["a"], 700, reference_no="UTR-A-1", payment_date="2026-10-06").status_code == 409
    # an identical double-submit returns the payment that already exists
    first = _pay(client, admin, world["b"], 500, reference_no="UTR-B-1", payment_date="2026-10-05")
    again = _pay(client, admin, world["b"], 500, reference_no="UTR-B-1", payment_date="2026-10-05")
    assert first.status_code == 200 and again.status_code in (200, 409)
    b = _billing(client, admin, world["b"])
    assert b["total_paid"] == 500.0 and b["outstanding"] == 2000.0
    # a duplicate row already sitting in the database (same payment_id) is ignored by the calculation
    row = LOOP.run_until_complete(server.db["erp_payments"].find_one({"reference_no": "UTR-B-1"}, {"_id": 0}))
    LOOP.run_until_complete(server.db["erp_payments"].insert_one({**row, "id": "PMT-DUP-ROW"}))
    b = _billing(client, admin, world["b"])
    assert b["total_paid"] == 500.0 and b["ignored"]["duplicate_payments"] == 1
    LOOP.run_until_complete(server.db["erp_payments"].delete_one({"id": "PMT-DUP-ROW"}))


def test_failed_or_pending_payments_are_not_paid(client, admin, world):
    assert _pay(client, admin, world["c"], 300, status="Pending", reference_no="UTR-C-P").status_code == 200
    assert _pay(client, admin, world["c"], 300, status="Failed", reference_no="UTR-C-F").status_code == 200
    c = _billing(client, admin, world["c"])
    assert c["total_paid"] == 0 and c["pending_payments"] == 600.0


def test_invoice_replaces_booking_fee_without_double_counting(client, admin, world):
    inv = client.post("/api/invoices", headers=admin, json={
        "invoice_no": "INV-BILL-1", "customer_id": world["c"], "booking_id": world["bk_c2"]["id"],
        "service_id": world["s1000"]["id"], "taxable": 1000, "rate": 18})
    assert inv.status_code == 200, inv.text
    assert inv.json()["data"]["total"] == 1180.0
    c = _billing(client, admin, world["c"])
    assert c["total_billed"] == 4129.0 + 1180.0      # the 1000 booking is billed through its invoice, once
    r = _pay(client, admin, world["c"], 500, invoice_no="INV-BILL-1", reference_no="UTR-C-1", payment_date="2026-10-05")
    assert r.status_code == 200, r.text
    c, a = _billing(client, admin, world["c"]), _billing(client, admin, world["a"])
    assert c["total_paid"] == 500.0 and c["outstanding"] == 4129.0 + 1180.0 - 500.0
    assert a["total_paid"] == 1000.0                  # untouched by Charlie's payment
    # cancelling the invoice's booking makes it non-billable
    assert client.put(f"/api/bookings/{world['bk_c2']['id']}", headers=admin, json={"status": "Cancelled"}).status_code == 200
    assert _billing(client, admin, world["c"])["total_billed"] == 4129.0


def test_customers_list_and_billing_agree_and_survive_refresh(client, admin, world):
    rows = {r["id"]: r for r in client.get("/api/customers", headers=admin).json()["data"]}
    for key in ("a", "b", "c"):
        for _ in range(2):                            # "refresh": every call is read from MongoDB again
            bill = _billing(client, admin, world[key])
            row = rows[world[key]]
            assert row["invoiced_amount"] == bill["total_billed"]
            assert row["paid_amount"] == bill["total_paid"]
            assert row["outstanding"] == bill["outstanding"]


def test_billing_is_admin_only_and_404_for_unknown(client, admin, world):
    assert client.get(f"/api/admin/customers/{world['a']}/billing", headers=world["a_h"]).status_code == 403
    assert client.get("/api/admin/customers/NOPE/billing", headers=admin).status_code == 404


def test_admin_status_reaches_the_right_customer_only(client, admin, world):
    for new in ("Confirmed", "Processing", "Completed", "Cancelled", "Pending"):
        r = client.put(f"/api/bookings/{world['bk_a']['id']}", headers=admin, json={"status": new})
        assert r.status_code == 200, r.text
        mine = {x["id"]: x for x in client.get("/api/bookings", headers=world["a_h"]).json()["data"]}
        other = {x["id"]: x for x in client.get("/api/bookings", headers=world["b_h"]).json()["data"]}
        assert mine[world["bk_a"]["id"]]["status"] == new
        assert world["bk_a"]["id"] not in other
        assert other[world["bk_b"]["id"]]["status"] == "Pending"   # never mixed between customers


def test_unlinked_customer_login_still_sees_own_booking_status(client, admin, world):
    """Legacy accounts without meta.customer_id used to get an empty booking list."""
    LOOP.run_until_complete(server.db.users.update_one({"role": "customer", "meta.customer_id": world["b"]}, {"$unset": {"meta.customer_id": ""}}))
    assert client.put(f"/api/bookings/{world['bk_b']['id']}", headers=admin, json={"status": "Processing"}).status_code == 200
    rows = client.get("/api/bookings", headers=world["b_h"]).json()["data"]
    assert [r["status"] for r in rows if r["id"] == world["bk_b"]["id"]] == ["Processing"]
    assert all(r["customer_id"] == world["b"] for r in rows)
