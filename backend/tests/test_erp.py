"""NTAXCO ERP Phase-2 CRUD + customer dashboard tests"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# ---- seed listing (validates seed_erp ran) ----
@pytest.mark.parametrize("name,min_count", [
    ("employees", 5),
    ("customers", 6),
    ("bookings", 8),
    ("projects", 8),
    ("invoices", 8),
    ("documents", 7),
    ("tickets", 3),
    ("services", 15),
])
def test_list_seed_counts(s, name, min_count):
    r = s.get(f"{API}/{name}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["success"] is True
    data = body["data"]
    assert isinstance(data, list)
    assert len(data) >= min_count, f"{name}: got {len(data)} expected >= {min_count}"
    # ensure no mongo _id leaks
    assert "_id" not in data[0]


# ---- get by id ----
def test_get_employee_by_id(s):
    r = s.get(f"{API}/employees/EMP001")
    assert r.status_code == 200
    d = r.json()["data"]
    assert d["id"] == "EMP001"
    assert d["name"] == "Rahul Sharma"


def test_get_missing_returns_404(s):
    r = s.get(f"{API}/employees/NOPE-XYZ")
    assert r.status_code == 404


# ---- search filter ----
def test_search_customer(s):
    r = s.get(f"{API}/customers", params={"search": "TechNova"})
    assert r.status_code == 200
    data = r.json()["data"]
    assert len(data) >= 1
    assert any("TechNova" in c["business_name"] for c in data)


# ---- CRUD lifecycle on employees ----
def test_employee_full_crud(s):
    payload = {"emp_id": "TEST_EMP", "name": "TEST_Employee", "email": "test_emp@ntaxco.com",
               "mobile": "9000000001", "department": "QA", "designation": "Tester", "status": "Active"}
    # CREATE
    cr = s.post(f"{API}/employees", json=payload)
    assert cr.status_code == 200, cr.text
    created = cr.json()["data"]
    new_id = created["id"]
    assert created["name"] == "TEST_Employee"

    # GET
    g = s.get(f"{API}/employees/{new_id}")
    assert g.status_code == 200
    assert g.json()["data"]["name"] == "TEST_Employee"

    # UPDATE
    u = s.put(f"{API}/employees/{new_id}", json={"designation": "Sr Tester"})
    assert u.status_code == 200
    assert u.json()["data"]["designation"] == "Sr Tester"
    # verify persistence
    g2 = s.get(f"{API}/employees/{new_id}")
    assert g2.json()["data"]["designation"] == "Sr Tester"

    # DELETE
    d = s.delete(f"{API}/employees/{new_id}")
    assert d.status_code == 200
    # verify gone
    g3 = s.get(f"{API}/employees/{new_id}")
    assert g3.status_code == 404


def test_customer_create_and_delete(s):
    payload = {"business_name": "TEST_ClientCo", "owner": "TEST_Owner", "gst_number": "29TEST9999X1Z1",
               "pan": "TESTX9999X", "mobile": "9000000002", "email": "t@test.in", "status": "Active"}
    cr = s.post(f"{API}/customers", json=payload)
    assert cr.status_code == 200
    new_id = cr.json()["data"]["id"]
    assert new_id.startswith("CUS")
    dr = s.delete(f"{API}/customers/{new_id}")
    assert dr.status_code == 200


def test_update_missing_returns_404(s):
    r = s.put(f"{API}/employees/NOPE-XYZ", json={"name": "x"})
    assert r.status_code == 404


def test_delete_missing_returns_404(s):
    r = s.delete(f"{API}/employees/NOPE-XYZ")
    assert r.status_code == 404


# ---- invoice GST breakup structure ----
def test_invoice_gst_breakup(s):
    r = s.get(f"{API}/invoices/INV-3001")
    assert r.status_code == 200
    d = r.json()["data"]
    for k in ("cgst", "sgst", "igst", "total", "taxable", "gst_number"):
        assert k in d, f"missing {k}"
    # intrastate invoice: cgst == sgst, igst == 0
    assert d["cgst"] == d["sgst"]
    assert d["igst"] == 0


def test_invoice_interstate_has_igst(s):
    r = s.get(f"{API}/invoices/INV-3002")
    assert r.status_code == 200
    d = r.json()["data"]
    assert d["igst"] > 0
    assert d["cgst"] == 0 and d["sgst"] == 0


# ---- customer dashboard ----
def test_customer_dashboard(s):
    r = s.get(f"{API}/customer/dashboard")
    assert r.status_code == 200
    cards = r.json()["data"]["cards"]
    for k in ("gst_filed", "itr_filed", "active_projects", "outstanding", "documents", "tickets"):
        assert k in cards


# ---- services catalog ----
def test_services_list_has_titles(s):
    r = s.get(f"{API}/services")
    assert r.status_code == 200
    data = r.json()["data"]
    titles = {x["title"] for x in data}
    assert "GST Registration" in titles
    assert "Company Registration" in titles
