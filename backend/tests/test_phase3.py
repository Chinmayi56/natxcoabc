"""NTAXCO ERP Phase-3 tests: compliance modules, accounting summary, employee/agent collections."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# --- Seed counts for new Phase-3 collections ---
@pytest.mark.parametrize("name,min_count", [
    ("gst", 6),
    ("itr", 5),
    ("tds", 4),
    ("roc", 4),
    ("attendance", 6),
    ("leaves", 4),
    ("tasks", 6),
    ("payslips", 4),
    ("leads", 6),
    ("appointments", 4),
    ("commissions", 4),
    ("journal", 6),
])
def test_seed_counts_phase3(s, name, min_count):
    r = s.get(f"{API}/{name}")
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert isinstance(data, list)
    assert len(data) >= min_count, f"{name}: got {len(data)} expected >= {min_count}"
    assert "_id" not in data[0]


# --- Accounting summary ---
def test_accounting_summary(s):
    r = s.get(f"{API}/accounting/summary")
    assert r.status_code == 200
    d = r.json()["data"]
    for k in ("income", "expenses", "profit", "cash_flow", "pnl", "balance_sheet", "trial_balance"):
        assert k in d, f"missing {k}"
    assert isinstance(d["cash_flow"], list) and len(d["cash_flow"]) >= 4
    assert isinstance(d["pnl"], list) and len(d["pnl"]) >= 4
    assert isinstance(d["balance_sheet"], list)
    assert isinstance(d["trial_balance"], list)


# --- CRUD lifecycles on new collections ---
@pytest.mark.parametrize("name,payload", [
    ("gst", {"return_type": "GSTR-1", "client": "TEST_Client", "gstin": "29TEST9999X1Z1", "status": "Pending"}),
    ("itr", {"client": "TEST_Client", "ay": "2026-27", "return_no": "ITR-6", "status": "Pending"}),
    ("tds", {"client": "TEST_Client", "form": "24Q", "quarter": "Q1", "status": "Pending"}),
    ("roc", {"company": "TEST_Client", "form": "AOC-4", "status": "Pending"}),
    ("leaves", {"leave_type": "Casual", "from_date": "2026-08-01", "to_date": "2026-08-01", "days": 1, "status": "Pending"}),
    ("tasks", {"title": "TEST_task", "priority": "Low", "progress": 0, "status": "Pending"}),
    ("leads", {"business_name": "TEST_Lead", "contact_person": "TEST", "mobile": "9000000000", "status": "New"}),
    ("appointments", {"business_name": "TEST_Apt", "date": "2026-08-05", "time": "10:00", "status": "Upcoming"}),
])
def test_crud_lifecycle(s, name, payload):
    cr = s.post(f"{API}/{name}", json=payload)
    assert cr.status_code == 200, cr.text
    new_id = cr.json()["data"]["id"]

    g = s.get(f"{API}/{name}/{new_id}")
    assert g.status_code == 200

    u = s.put(f"{API}/{name}/{new_id}", json={"status": "Updated"})
    assert u.status_code == 200
    assert u.json()["data"]["status"] == "Updated"

    d = s.delete(f"{API}/{name}/{new_id}")
    assert d.status_code == 200
    assert s.get(f"{API}/{name}/{new_id}").status_code == 404


# --- Attendance check-in flow simulation (create row) ---
def test_attendance_create(s):
    payload = {"date": "2026-07-29", "check_in": "09:15", "check_out": "-", "hours": "0h", "status": "Present"}
    r = s.post(f"{API}/attendance", json=payload)
    assert r.status_code == 200
    new_id = r.json()["data"]["id"]
    s.delete(f"{API}/attendance/{new_id}")


# --- Onboarding: create customer via POST /api/customers ---
def test_onboarding_creates_customer(s):
    payload = {"business_name": "TEST_Onboard Co", "owner": "TEST_Owner", "mobile": "9000000099",
               "email": "onb@test.in", "status": "Active"}
    r = s.post(f"{API}/customers", json=payload)
    assert r.status_code == 200
    new_id = r.json()["data"]["id"]
    assert new_id.startswith("CUS")
    s.delete(f"{API}/customers/{new_id}")
