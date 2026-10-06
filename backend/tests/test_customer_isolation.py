"""Customer data isolation: Customer A must never see or touch Customer B's profile, bookings,
payments or invoices - enforced by the backend, not the frontend.

Runs the real FastAPI app in-process on mongomock-motor.
Run:  cd backend && python -m pytest -c /dev/null --rootdir=. tests/test_customer_isolation.py
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
os.environ.setdefault("DB_NAME", "ntaxco_isolation_test")
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


def _register(client, admin, name, mobile):
    email = f"{name.lower()}.{uuid.uuid4().hex[:5]}@example.com"
    r = client.post("/api/auth/register", json={"full_name": name, "email": email, "password": "CustPass#123",
                                                 "role": "customer", "mobile": mobile})
    assert r.status_code == 200, r.text
    headers = {"Authorization": f"Bearer {r.json()['data']['access_token']}"}
    cid = [c for c in client.get("/api/customers", headers=admin).json()["data"] if c.get("email") == email][0]["id"]
    return headers, cid, email


@pytest.fixture(scope="module")
def world(client, admin):
    svc = client.post("/api/services", headers=admin, json={
        "name": "GST Filing", "title": "GST Filing", "category": "GST", "description": "x", "final_price": 1000,
        "status": "Active"}).json()["data"]
    a_h, a, a_mail = _register(client, admin, "Alpha", "9100000001")
    b_h, b, b_mail = _register(client, admin, "Bravo", "9100000002")
    out = dict(svc=svc, a_h=a_h, a=a, a_mail=a_mail, b_h=b_h, b=b, b_mail=b_mail)
    for key, h, mail in (("a", a_h, a_mail), ("b", b_h, b_mail)):
        r = client.post("/api/bookings", headers=h, json={"service_id": svc["id"], "service": svc["name"], "email": mail,
                                                         "client_request_id": uuid.uuid4().hex})
        assert r.status_code == 200, r.text
        bk = r.json()["data"]
        inv = client.post("/api/invoices", headers=admin, json={
            "invoice_no": f"INV-ISO-{key.upper()}", "customer_id": out[key], "booking_id": bk["id"],
            "service_id": svc["id"], "taxable": 1000, "rate": 18})
        assert inv.status_code == 200, inv.text
        pay = client.post("/api/payments", headers=admin, json={
            "customer_id": out[key], "invoice_no": f"INV-ISO-{key.upper()}", "amount": 500, "status": "Completed",
            "payment_method": "UPI", "reference_no": f"UTR-ISO-{key.upper()}", "payment_date": "2026-10-05"})
        assert pay.status_code == 200, pay.text
        out[f"bk_{key}"], out[f"inv_{key}"], out[f"pay_{key}"] = bk, inv.json()["data"], pay.json()["data"]
    return out


def _ids(client, headers, path):
    r = client.get(path, headers=headers)
    assert r.status_code == 200, (path, r.text)
    return r.json()["data"]


def test_profile_is_only_my_own(client, world):
    for me, other, h in (("a", "b", world["a_h"]), ("b", "a", world["b_h"])):
        rows = _ids(client, h, "/api/customers")
        assert [r["id"] for r in rows] == [world[me]]
        assert rows[0]["email"] == world[f"{me}_mail"]
        assert client.get(f"/api/customers/{world[other]}", headers=h).status_code == 404
        assert client.get(f"/api/customers/{world[me]}", headers=h).status_code == 200


def test_bookings_are_only_mine(client, world):
    for me, other, h in (("a", "b", world["a_h"]), ("b", "a", world["b_h"])):
        rows = _ids(client, h, "/api/bookings")
        assert [r["id"] for r in rows] == [world[f"bk_{me}"]["id"]]
        assert all(r["customer_id"] == world[me] for r in rows)
        assert client.get(f"/api/bookings/{world[f'bk_{other}']['id']}", headers=h).status_code == 404


def test_invoices_are_only_mine(client, world):
    for me, other, h in (("a", "b", world["a_h"]), ("b", "a", world["b_h"])):
        rows = _ids(client, h, "/api/invoices")
        assert [r["invoice_no"] for r in rows] == [f"INV-ISO-{me.upper()}"]
        assert all(r["customer_id"] == world[me] for r in rows)
        assert client.get(f"/api/invoices/{world[f'inv_{other}']['id']}", headers=h).status_code == 404
        assert client.get(f"/api/invoices/{world[f'inv_{me}']['id']}", headers=h).status_code == 200


def test_payments_are_only_mine(client, world):
    for me, other, h in (("a", "b", world["a_h"]), ("b", "a", world["b_h"])):
        rows = _ids(client, h, "/api/payments")
        assert [r["reference_no"] for r in rows] == [f"UTR-ISO-{me.upper()}"]
        assert client.get(f"/api/payments/{world[f'pay_{other}']['id']}", headers=h).status_code == 404


def test_cannot_modify_other_customers_booking(client, world):
    b_bk = world["bk_b"]["id"]
    r = client.put(f"/api/bookings/{b_bk}", headers=world["a_h"], json={"status": "Cancelled"})
    assert r.status_code in (403, 404), r.text
    r = client.delete(f"/api/bookings/{b_bk}", headers=world["a_h"])
    assert r.status_code in (403, 404), r.text
    assert _ids(client, world["b_h"], "/api/bookings")[0]["status"] != "Cancelled"


def test_cannot_book_on_behalf_of_another_customer(client, world):
    r = client.post("/api/bookings", headers=world["a_h"], json={
        "service_id": world["svc"]["id"], "service": world["svc"]["name"], "customer_id": world["b"],
        "email": world["b_mail"], "client_request_id": uuid.uuid4().hex})
    if r.status_code == 200:
        assert r.json()["data"]["customer_id"] == world["a"]
    assert all(x["customer_id"] == world["b"] for x in _ids(client, world["b_h"], "/api/bookings"))


def test_unlinked_login_with_unlinked_rows_sees_nothing_of_others(client, admin, world):
    """A login whose meta.customer_id is missing and which matches no customer record must not
    match rows that have no customer_id either."""
    LOOP.run_until_complete(server.db["erp_invoices"].insert_one({
        "id": "INV-ORPHAN", "invoice_no": "INV-ORPHAN", "customer": "Ghost", "total": 10, "status": "Issued"}))
    LOOP.run_until_complete(server.db["erp_bookings"].insert_one({
        "id": "BK-ORPHAN", "booking_no": "BK-ORPHAN", "customer": "Ghost", "status": "Pending"}))
    uid = f"CUST-{uuid.uuid4().hex[:6].upper()}"
    email, pw = f"ghost-{uuid.uuid4().hex[:5]}@example.com", "CustPass#123"
    LOOP.run_until_complete(server.db.users.insert_one({
        "id": uid, "name": "Nobody", "email": email, "mobile": "9199999999", "role": "customer",
        "password_hash": server.hash_password(pw), "status": "active", "meta": {}}))
    r = client.post("/api/auth/portal/login", json={"email": email, "password": pw, "role": "customer"})
    assert r.status_code == 200, r.text
    h = {"Authorization": f"Bearer {r.json()['data']['access_token']}"}
    assert _ids(client, h, "/api/invoices") == []
    assert _ids(client, h, "/api/bookings") == []
    assert _ids(client, h, "/api/payments") == []
    assert client.get("/api/invoices/INV-ORPHAN", headers=h).status_code == 404


def test_requires_authentication(client):
    for p in ("/api/customers", "/api/bookings", "/api/invoices", "/api/payments"):
        assert client.get(p).status_code in (401, 403)


def test_legacy_invoice_without_customer_id_follows_its_booking_owner(client, world):
    """An invoice saved without customer_id but pointing at A's booking shows for A only."""
    LOOP.run_until_complete(server.db["erp_invoices"].insert_one({
        "id": "INV-LEGACY-A", "invoice_no": "INV-LEGACY-A", "customer": "Alpha", "booking_id": world["bk_a"]["id"],
        "total": 99, "status": "Issued"}))
    a = [r["invoice_no"] for r in _ids(client, world["a_h"], "/api/invoices")]
    b = [r["invoice_no"] for r in _ids(client, world["b_h"], "/api/invoices")]
    assert "INV-LEGACY-A" in a and "INV-LEGACY-A" not in b
    assert client.get("/api/invoices/INV-LEGACY-A", headers=world["a_h"]).status_code == 200
    assert client.get("/api/invoices/INV-LEGACY-A", headers=world["b_h"]).status_code == 404


def test_booking_chat_still_works_for_owner_and_admin_but_not_other_customer(client, admin, world):
    bk = world["bk_a"]["id"]
    sent = client.post(f"/api/bookings/{bk}/messages", headers=world["a_h"], json={"text": "hello from A", "message": "hello from A"})
    assert sent.status_code == 200, sent.text
    assert client.get(f"/api/bookings/{bk}/messages", headers=world["a_h"]).status_code == 200
    assert client.get(f"/api/bookings/{bk}/messages", headers=admin).status_code == 200
    assert client.get(f"/api/bookings/{bk}/messages", headers=world["b_h"]).status_code in (403, 404)
    assert client.post(f"/api/bookings/{bk}/messages", headers=world["b_h"], json={"text": "intruder", "message": "intruder"}).status_code in (403, 404)


def test_admin_still_sees_everything(client, admin, world):
    assert {world["bk_a"]["id"], world["bk_b"]["id"]} <= {b["id"] for b in _ids(client, admin, "/api/bookings")}
    assert {"INV-ISO-A", "INV-ISO-B"} <= {i["invoice_no"] for i in _ids(client, admin, "/api/invoices")}
